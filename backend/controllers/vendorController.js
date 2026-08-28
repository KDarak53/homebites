const asyncHandler = require('express-async-handler');
const VendorProfile = require('../models/VendorProfile');
const Order = require('../models/Order');
const PlatformSettings = require('../models/PlatformSettings');
const { createPaymentOrder, verifyPaymentSignature } = require('../config/payments');

const NEW_VENDOR_ORDER_THRESHOLD = 10;

// @desc  Discover vendors near the customer, with filters
// @route GET /api/vendors?lng=&lat=&radiusKm=&veg=&sort=
const getNearbyVendors = asyncHandler(async (req, res) => {
  const { lng, lat, radiusKm = 10, veg, sort } = req.query;

  if (lng == null || lat == null) {
    res.status(400);
    throw new Error('lng and lat query params are required');
  }

  const filter = { isApproved: true, isOpen: true };
  if (veg === 'true') filter.isVegOnly = true;

  // $geoNear (rather than a plain $near filter) is needed to get each
  // vendor's actual distance back for display — a filter-only $near sorts by
  // distance but discards the computed value.
  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distanceMeters',
        maxDistance: parseFloat(radiusKm) * 1000,
        spherical: true,
        query: filter,
      },
    },
    {
      // Paid "pro" vendors get priority placement ahead of the requested
      // sort — the one thing a vendor's subscription fee actually buys them
      // beyond a lower commission rate.
      $addFields: {
        isPro: {
          $and: [{ $eq: ['$subscriptionPlan', 'pro'] }, { $gt: ['$subscriptionExpiresAt', new Date()] }],
        },
        isNew: { $lt: ['$totalOrdersCompleted', NEW_VENDOR_ORDER_THRESHOLD] },
      },
    },
  ];

  if (sort === 'rating') pipeline.push({ $sort: { isPro: -1, averageRating: -1 } });
  else if (sort === 'orders') pipeline.push({ $sort: { isPro: -1, totalOrdersCompleted: -1 } });
  else pipeline.push({ $sort: { isPro: -1, distanceMeters: 1 } });

  pipeline.push({ $limit: 50 });

  const vendors = await VendorProfile.aggregate(pipeline);
  const withDistance = vendors.map((v) => ({ ...v, distanceKm: Math.round((v.distanceMeters / 1000) * 10) / 10 }));

  res.json(withDistance);
});

// @desc  Get a single vendor's public profile
// @route GET /api/vendors/:id
const getVendorById = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findById(req.params.id).populate('user', 'name');
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  const obj = vendor.toObject();
  obj.isNew = vendor.totalOrdersCompleted < NEW_VENDOR_ORDER_THRESHOLD;
  res.json(obj);
});

// @desc  Get logged-in vendor's own profile
// @route GET /api/vendors/me/profile
const getMyVendorProfile = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }
  res.json(vendor);
});

// @desc  Update fulfillment settings (delivery toggle + radius) and profile basics
// @route PATCH /api/vendors/me/settings
const updateFulfillmentSettings = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }

  const { deliveryEnabled, maxDeliveryRadiusKm, deliveryFee, isOpen, businessName, description, kitchenPhotoUrl } = req.body;

  if (deliveryEnabled !== undefined) vendor.deliveryEnabled = deliveryEnabled;
  if (maxDeliveryRadiusKm !== undefined) vendor.maxDeliveryRadiusKm = maxDeliveryRadiusKm;
  if (deliveryFee !== undefined) vendor.deliveryFee = deliveryFee;
  if (isOpen !== undefined) vendor.isOpen = isOpen;
  if (businessName !== undefined) vendor.businessName = businessName;
  if (description !== undefined) vendor.description = description;
  if (kitchenPhotoUrl !== undefined) vendor.kitchenPhotoUrl = kitchenPhotoUrl;

  await vendor.save();
  res.json(vendor);
});

// @desc  Vendor analytics: revenue, commission paid, net payout, popular items
// @route GET /api/vendors/me/analytics?range=daily|weekly
const getVendorAnalytics = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }

  const { range = 'weekly' } = req.query;
  const days = range === 'daily' ? 1 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await Order.find({
    vendor: vendor._id,
    status: 'Completed',
    createdAt: { $gte: since },
  });

  const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const commissionPaid = orders.reduce((sum, o) => sum + o.platformCommissionAmount, 0);
  const netPayout = orders.reduce((sum, o) => sum + o.vendorPayoutAmount, 0);

  const itemCounts = {};
  orders.forEach((o) =>
    o.items.forEach((i) => {
      itemCounts[i.itemName] = (itemCounts[i.itemName] || 0) + i.quantity;
    })
  );
  const popularItems = Object.entries(itemCounts)
    .map(([itemName, qty]) => ({ itemName, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  res.json({ range, ordersCompleted: orders.length, revenue, commissionPaid, netPayout, popularItems });
});

// @desc  Step 1: price the "pro" subscription upgrade and open a payable unit
// @route POST /api/vendors/me/upgrade/initiate
const initiateUpgrade = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.getSingleton();
  const paymentOrder = await createPaymentOrder({
    amountRupees: settings.proSubscriptionPricePerMonth,
    receipt: `pro_${req.user._id}_${Date.now()}`,
  });
  res.json({ ...paymentOrder, amountRupees: settings.proSubscriptionPricePerMonth });
});

// @desc  Step 2: verify payment and activate/extend the "pro" tier for 30 days
// @route POST /api/vendors/me/upgrade/confirm
const confirmUpgrade = asyncHandler(async (req, res) => {
  const { gatewayOrderId, paymentId, signature } = req.body;
  if (!verifyPaymentSignature({ gatewayOrderId, paymentId, signature })) {
    res.status(400);
    throw new Error('Payment could not be verified');
  }

  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }

  const base = vendor.subscriptionExpiresAt && vendor.subscriptionExpiresAt > new Date() ? vendor.subscriptionExpiresAt : new Date();
  vendor.subscriptionPlan = 'pro';
  vendor.subscriptionExpiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
  await vendor.save();

  res.json(vendor);
});

module.exports = {
  getNearbyVendors,
  getVendorById,
  getMyVendorProfile,
  updateFulfillmentSettings,
  getVendorAnalytics,
  initiateUpgrade,
  confirmUpgrade,
};
