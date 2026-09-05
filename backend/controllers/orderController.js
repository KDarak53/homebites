const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const VendorProfile = require('../models/VendorProfile');
const Order = require('../models/Order');
const PlatformSettings = require('../models/PlatformSettings');
const generatePickupCode = require('../utils/generatePickupCode');
const { createPaymentOrder, verifyPaymentSignature } = require('../config/payments');
const { getActiveProvider, estimateDeliveryCost } = require('../services/deliveryProvider');
const { notify } = require('../services/notify');
const { computeCommission } = require('../utils/commission');

const EARTH_RADIUS_M = 6378137;

// Haversine distance in km between two [lng, lat] points
function distanceKm([lng1, lat1], [lng2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (EARTH_RADIUS_M * c) / 1000;
}

// Shared validation for both initiate and confirm — throws a plain Error
// with a user-facing message on any problem. Returns the vendor doc and the
// computed totals so callers don't repeat the arithmetic.
async function validateAndPrice({ vendorId, items, orderType, fulfillmentMethod, scheduledFor, deliveryCoordinates }) {
  if (!vendorId || !Array.isArray(items) || items.length === 0 || !orderType || !fulfillmentMethod) {
    throw new Error('vendorId, items, orderType and fulfillmentMethod are required');
  }

  const vendor = await VendorProfile.findById(vendorId);
  if (!vendor || !vendor.isApproved) {
    throw new Error('Vendor is not available for orders right now');
  }
  if (vendor.isSuspendedByAdmin) {
    throw new Error('This kitchen has been paused by HomeBites and is not accepting orders right now');
  }
  if (!vendor.isOpen) {
    throw new Error('Vendor is not available for orders right now');
  }

  if (fulfillmentMethod === 'Delivery') {
    const settings = await PlatformSettings.getSingleton();
    if (!settings.deliveryRolloutEnabled) {
      throw new Error('Delivery is paused platform-wide for this rollout phase — please choose Takeaway or Pre-book.');
    }
    if (!vendor.deliveryEnabled) {
      throw new Error('This vendor does not offer delivery');
    }
    if (!deliveryCoordinates || deliveryCoordinates.length !== 2) {
      throw new Error('deliveryCoordinates [lng, lat] required for delivery orders');
    }
    const dist = distanceKm(vendor.kitchenLocation.coordinates, deliveryCoordinates);
    if (dist > vendor.maxDeliveryRadiusKm) {
      throw new Error(
        `Delivery address is ${dist.toFixed(1)}km away, outside the vendor's ${vendor.maxDeliveryRadiusKm}km delivery radius`
      );
    }
  }

  if (orderType === 'Prebook' && !scheduledFor) {
    throw new Error('scheduledFor is required for pre-booked orders');
  }

  let itemsTotal = 0;
  for (const line of items) {
    const product = await Product.findById(line.productId);
    if (!product || !product.isActive || String(product.vendor) !== String(vendor._id)) {
      throw new Error(`Product ${line.productId} is not available from this vendor`);
    }
    const qty = Number(line.quantity);
    if (!qty || qty < 1) throw new Error(`Invalid quantity for ${product.itemName}`);
    itemsTotal += product.price * qty;

    // If the vendor has set a collection window for this item's next batch,
    // the customer's chosen pickup/delivery time must actually fall inside
    // it — otherwise "scheduled for 2am" against a "ready 6-8pm" batch would
    // silently go through.
    if (orderType === 'Prebook' && (product.collectionStartTime || product.collectionEndTime)) {
      const when = new Date(scheduledFor).getTime();
      const start = product.collectionStartTime ? product.collectionStartTime.getTime() : -Infinity;
      const end = product.collectionEndTime ? product.collectionEndTime.getTime() : Infinity;
      if (Number.isNaN(when) || when < start || when > end) {
        throw new Error(
          `${product.itemName} is only ready for collection between ${
            product.collectionStartTime ? product.collectionStartTime.toLocaleString() : 'now'
          } and ${product.collectionEndTime ? product.collectionEndTime.toLocaleString() : 'further notice'}`
        );
      }
    }
  }

  const deliveryFee = fulfillmentMethod === 'Delivery' ? vendor.deliveryFee || 0 : 0;
  const totalAmount = itemsTotal + deliveryFee;

  const { platformCommissionRate, platformCommissionAmount, vendorPayoutAmount } = await computeCommission(vendor, itemsTotal);

  return { vendor, itemsTotal, deliveryFee, totalAmount, platformCommissionRate, platformCommissionAmount, vendorPayoutAmount };
}

// @desc  Step 1 of checkout: price the order and open a payable unit
//        (a real Razorpay order, or a mock equivalent in dev) — no
//        inventory is touched yet, since payment may never complete.
// @route POST /api/orders/initiate
const initiatePayment = asyncHandler(async (req, res) => {
  const pricing = await validateAndPrice(req.body);
  const paymentOrder = await createPaymentOrder({
    amountRupees: pricing.totalAmount,
    receipt: `order_${req.user._id}_${Date.now()}`,
  });

  res.json({
    ...paymentOrder,
    itemsTotal: pricing.itemsTotal,
    deliveryFee: pricing.deliveryFee,
    totalAmount: pricing.totalAmount,
  });
});

// @desc  Step 2 of checkout: verify payment, then atomically reserve
//        inventory and create the order — mirrors the previous single-step
//        createOrder, but only runs after payment is confirmed.
// @route POST /api/orders/confirm
const confirmPayment = asyncHandler(async (req, res) => {
  const {
    vendorId,
    items,
    orderType,
    fulfillmentMethod,
    scheduledFor,
    deliveryCoordinates,
    deliveryAddress,
    gatewayOrderId,
    paymentId,
    signature,
  } = req.body;

  if (!gatewayOrderId || !paymentId) {
    res.status(400);
    throw new Error('Payment reference missing');
  }
  if (!verifyPaymentSignature({ gatewayOrderId, paymentId, signature })) {
    res.status(400);
    throw new Error('Payment could not be verified');
  }

  const { vendor, itemsTotal, deliveryFee, totalAmount, platformCommissionRate, platformCommissionAmount, vendorPayoutAmount } =
    await validateAndPrice({ vendorId, items, orderType, fulfillmentMethod, scheduledFor, deliveryCoordinates });

  const session = await mongoose.startSession();
  let createdOrder;

  try {
    await session.withTransaction(async () => {
      const orderItems = [];

      for (const line of items) {
        const product = await Product.findById(line.productId).session(session);
        if (!product || !product.isActive || String(product.vendor) !== String(vendor._id)) {
          throw new Error(`Product ${line.productId} is not available from this vendor`);
        }

        const qty = Number(line.quantity);
        let fromBatch = 'current';

        if (orderType === 'Direct') {
          if (!product.availableForDirectOrder) {
            throw new Error(`${product.itemName} is not available for direct order`);
          }
          // Atomic conditional decrement prevents the race condition where two
          // customers buy the last plate simultaneously.
          const updated = await Product.findOneAndUpdate(
            { _id: product._id, currentQuantity: { $gte: qty } },
            { $inc: { currentQuantity: -qty } },
            { new: true, session }
          );
          if (!updated) {
            throw new Error(`Only limited stock left for ${product.itemName}; someone just grabbed it`);
          }
        } else {
          // Prebook: draw from the next batch, gated by the open/close window.
          const now = Date.now();
          const windowNotOpenYet = product.prebookOpensAt && product.prebookOpensAt.getTime() > now;
          if (
            !product.availableForPrebook ||
            !product.prebookCutoffTime ||
            product.prebookCutoffTime.getTime() <= now ||
            windowNotOpenYet
          ) {
            throw new Error(
              windowNotOpenYet
                ? `Pre-booking for ${product.itemName} opens ${product.prebookOpensAt.toLocaleString()}`
                : `Pre-booking is closed for ${product.itemName}`
            );
          }
          fromBatch = 'next';
          const updated = await Product.findOneAndUpdate(
            { _id: product._id, nextBatchQuantity: { $gte: qty } },
            { $inc: { nextBatchQuantity: -qty } },
            { new: true, session }
          );
          if (!updated) {
            throw new Error(`Pre-book batch is full for ${product.itemName}`);
          }
        }

        orderItems.push({
          product: product._id,
          itemName: product.itemName,
          unitPrice: product.price,
          quantity: qty,
          fromBatch,
        });
      }

      const [order] = await Order.create(
        [
          {
            user: req.user._id,
            vendor: vendor._id,
            items: orderItems,
            orderType,
            fulfillmentMethod,
            scheduledFor: orderType === 'Prebook' ? scheduledFor : null,
            deliveryAddress:
              fulfillmentMethod === 'Delivery'
                ? { coordinates: deliveryCoordinates, address: deliveryAddress || '' }
                : undefined,
            itemsTotal,
            deliveryFee,
            totalAmount,
            platformCommissionRate,
            platformCommissionAmount,
            vendorPayoutAmount,
            paymentStatus: 'paid',
            gatewayOrderId,
            paymentId,
            status: 'Pending',
            pickupCode: generatePickupCode(),
          },
        ],
        { session }
      );

      createdOrder = order;
    });
  } finally {
    session.endSession();
  }

  const io = req.app.get('io');
  io?.to(`vendor:${vendor._id}`).emit('order:new', createdOrder);
  await notify(io, {
    userId: vendor.user,
    type: 'new_order',
    title: 'New order received',
    body: `${createdOrder.items.length} item(s) · ₹${createdOrder.totalAmount}`,
    relatedOrder: createdOrder._id,
  });

  res.status(201).json(createdOrder);
});

// @desc  Customer: list own orders
// @route GET /api/orders/my
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('vendor', 'businessName')
    .sort({ createdAt: -1 });
  res.json(orders);
});

// @desc  Vendor: live dashboard, split into Immediate vs Pre-booked streams
// @route GET /api/orders/vendor/dashboard
const getVendorDashboard = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }

  const activeStatuses = ['Pending', 'Accepted', 'Preparing', 'Ready', 'OutForDelivery'];
  const orders = await Order.find({ vendor: vendor._id, status: { $in: activeStatuses } })
    .populate('user', 'name phone')
    .sort({ createdAt: -1 });

  res.json({
    immediate: orders.filter((o) => o.orderType === 'Direct'),
    prebooked: orders.filter((o) => o.orderType === 'Prebook'),
  });
});

const TRANSITIONS = {
  Pending: ['Accepted', 'Rejected'],
  Accepted: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready: ['OutForDelivery', 'Completed'],
  OutForDelivery: ['Completed'],
};

const RESTOCK_STATUSES = ['Rejected', 'Cancelled'];

// Returns reserved stock to the product it came from — called whenever an
// order is rejected/cancelled after inventory was already decremented at
// checkout. Without this, a rejected order's stock is gone for the rest of
// the batch even though nothing was ever cooked or sold.
async function restockOrderItems(order) {
  for (const item of order.items) {
    const field = item.fromBatch === 'next' ? 'nextBatchQuantity' : 'currentQuantity';
    await Product.updateOne({ _id: item.product }, { $inc: { [field]: item.quantity } });
  }
}

// @desc  Vendor: accept/reject/advance order status
// @route PATCH /api/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  const order = await Order.findOne({ _id: req.params.id, vendor: vendor._id });

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const allowedNext = TRANSITIONS[order.status] || [];
  if (!allowedNext.includes(status)) {
    res.status(400);
    throw new Error(`Cannot move order from ${order.status} to ${status}`);
  }

  if (RESTOCK_STATUSES.includes(status)) {
    await restockOrderItems(order);
  }

  if (status === 'OutForDelivery') {
    const provider = getActiveProvider();
    const pickup = await provider.requestPickup(order);
    order.deliveryProviderRef = pickup.providerRef || '';
    order.deliveryCostToProvider = pickup.estimatedCostRupees || estimateDeliveryCost(order.deliveryFee);
  }

  order.status = status;
  await order.save();

  if (status === 'Completed') {
    vendor.totalOrdersCompleted += 1;
    await vendor.save();
  }

  const io = req.app.get('io');
  io?.to(`user:${order.user}`).emit('order:status', { orderId: order._id, status: order.status });
  await notify(io, {
    userId: order.user,
    type: 'order_status',
    title: `Order ${status.toLowerCase()}`,
    body: `Your order from ${vendor.businessName} is now "${status}".`,
    relatedOrder: order._id,
  });

  res.json(order);
});

// @desc  Vendor: scan/enter the customer's pickup code to confirm handoff
//        and mark the order Completed, instead of a self-reported button.
// @route POST /api/orders/vendor/verify-pickup
const verifyPickup = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400);
    throw new Error('code is required');
  }

  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }

  const normalizedCode = String(code).trim().toUpperCase();
  const order = await Order.findOne({ vendor: vendor._id, pickupCode: normalizedCode }).populate(
    'user',
    'name phone'
  );

  if (!order) {
    res.status(404);
    throw new Error('Invalid pickup code');
  }
  if (order.status === 'Completed') {
    res.status(400);
    throw new Error('This order has already been picked up');
  }
  if (!['Ready', 'OutForDelivery'].includes(order.status)) {
    res.status(400);
    throw new Error(`Order isn't ready for pickup yet (current status: ${order.status})`);
  }

  order.status = 'Completed';
  order.pickupConfirmedAt = new Date();
  await order.save();

  vendor.totalOrdersCompleted += 1;
  await vendor.save();

  const io = req.app.get('io');
  io?.to(`user:${order.user._id}`).emit('order:status', { orderId: order._id, status: order.status });
  await notify(io, {
    userId: order.user._id,
    type: 'order_status',
    title: 'Order completed',
    body: `Your order from ${vendor.businessName} was confirmed picked up. Enjoy!`,
    relatedOrder: order._id,
  });

  res.json(order);
});

// @desc  Customer: rate a completed order's vendor
// @route POST /api/orders/:id/rate
const rateOrder = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  if (order.status !== 'Completed') {
    res.status(400);
    throw new Error('Can only rate completed orders');
  }
  if (order.rating) {
    res.status(400);
    throw new Error('Order already rated');
  }

  order.rating = rating;
  order.ratingComment = comment || '';
  await order.save();

  const vendor = await VendorProfile.findById(order.vendor);
  const newCount = vendor.ratingCount + 1;
  vendor.averageRating = (vendor.averageRating * vendor.ratingCount + rating) / newCount;
  vendor.ratingCount = newCount;
  await vendor.save();

  res.json(order);
});

module.exports = {
  initiatePayment,
  confirmPayment,
  getMyOrders,
  getVendorDashboard,
  updateOrderStatus,
  verifyPickup,
  rateOrder,
  restockOrderItems,
};
