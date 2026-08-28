const asyncHandler = require('express-async-handler');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const CustomerSubscription = require('../models/CustomerSubscription');
const VendorProfile = require('../models/VendorProfile');
const Product = require('../models/Product');
const { createPaymentOrder, verifyPaymentSignature } = require('../config/payments');

// ---------- Vendor: plan management ----------

// @desc  Vendor creates a subscription/meal plan
// @route POST /api/subscription-plans
const createPlan = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }

  const { name, description, items, daysOfWeek, pricePerWeek, fulfillmentMethod } = req.body;
  if (!name || !Array.isArray(items) || items.length === 0 || !pricePerWeek) {
    res.status(400);
    throw new Error('name, items and pricePerWeek are required');
  }

  const resolvedItems = [];
  for (const line of items) {
    const product = await Product.findOne({ _id: line.productId, vendor: vendor._id });
    if (!product) {
      res.status(400);
      throw new Error(`Product ${line.productId} does not belong to this vendor`);
    }
    resolvedItems.push({ product: product._id, itemName: product.itemName, quantity: line.quantity || 1 });
  }

  const plan = await SubscriptionPlan.create({
    vendor: vendor._id,
    name,
    description,
    items: resolvedItems,
    daysOfWeek: daysOfWeek || [1, 2, 3, 4, 5],
    pricePerWeek,
    fulfillmentMethod: fulfillmentMethod || 'Takeaway',
  });

  res.status(201).json(plan);
});

// @desc  Vendor: list own plans
// @route GET /api/subscription-plans/me
const getMyPlans = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }
  const plans = await SubscriptionPlan.find({ vendor: vendor._id }).sort({ createdAt: -1 });
  res.json(plans);
});

// @desc  Vendor: toggle/update a plan
// @route PATCH /api/subscription-plans/:id
const updatePlan = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  const plan = await SubscriptionPlan.findOne({ _id: req.params.id, vendor: vendor._id });
  if (!plan) {
    res.status(404);
    throw new Error('Plan not found');
  }
  const allowed = ['name', 'description', 'daysOfWeek', 'pricePerWeek', 'isActive'];
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) plan[f] = req.body[f];
  });
  await plan.save();
  res.json(plan);
});

// @desc  Public: a vendor's active subscription plans
// @route GET /api/subscription-plans/vendor/:vendorId
const getVendorPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find({ vendor: req.params.vendorId, isActive: true });
  res.json(plans);
});

// @desc  Vendor: subscriber roster across all their plans
// @route GET /api/subscriptions/vendor/roster
const getRoster = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findOne({ user: req.user._id });
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor profile not found');
  }
  const subs = await CustomerSubscription.find({ vendor: vendor._id, status: 'active' })
    .populate('user', 'name phone')
    .populate('plan', 'name pricePerWeek daysOfWeek')
    .sort({ createdAt: -1 });
  res.json(subs);
});

// ---------- Customer: subscribe / manage ----------

// @desc  Step 1: price a new subscription (or a recharge of an existing one)
//        and open a payable unit — same pattern as order checkout.
// @route POST /api/subscriptions/initiate
const initiateSubscriptionPayment = asyncHandler(async (req, res) => {
  const { planId, subscriptionId, weeks } = req.body;
  const weekCount = Number(weeks) || 1;

  let plan;
  if (subscriptionId) {
    const existing = await CustomerSubscription.findOne({ _id: subscriptionId, user: req.user._id });
    if (!existing) {
      res.status(404);
      throw new Error('Subscription not found');
    }
    plan = await SubscriptionPlan.findById(existing.plan);
  } else {
    plan = await SubscriptionPlan.findById(planId);
  }

  if (!plan || !plan.isActive) {
    res.status(404);
    throw new Error('Subscription plan not available');
  }

  const amountRupees = plan.pricePerWeek * weekCount;
  const paymentOrder = await createPaymentOrder({ amountRupees, receipt: `sub_${req.user._id}_${Date.now()}` });

  res.json({ ...paymentOrder, planId: plan._id, weeks: weekCount, amountRupees });
});

// @desc  Step 2: verify payment, then create/recharge the subscription with
//        `weeks * plan.daysOfWeek.length` prepaid credits.
// @route POST /api/subscriptions/confirm
const confirmSubscriptionPayment = asyncHandler(async (req, res) => {
  const { planId, subscriptionId, weeks, fulfillmentMethod, deliveryCoordinates, deliveryAddress, gatewayOrderId, paymentId, signature } =
    req.body;
  const weekCount = Number(weeks) || 1;

  if (!verifyPaymentSignature({ gatewayOrderId, paymentId, signature })) {
    res.status(400);
    throw new Error('Payment could not be verified');
  }

  if (subscriptionId) {
    const sub = await CustomerSubscription.findOne({ _id: subscriptionId, user: req.user._id });
    if (!sub) {
      res.status(404);
      throw new Error('Subscription not found');
    }
    const plan = await SubscriptionPlan.findById(sub.plan);
    sub.creditsRemaining += weekCount * plan.daysOfWeek.length;
    if (sub.status === 'paused') sub.status = 'active';
    await sub.save();
    return res.status(200).json(sub);
  }

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan || !plan.isActive) {
    res.status(404);
    throw new Error('Subscription plan not available');
  }
  if (plan.fulfillmentMethod === 'Delivery' && (!deliveryCoordinates || deliveryCoordinates.length !== 2)) {
    res.status(400);
    throw new Error('deliveryCoordinates required for a delivery subscription plan');
  }

  const sub = await CustomerSubscription.create({
    user: req.user._id,
    plan: plan._id,
    vendor: plan.vendor,
    creditsRemaining: weekCount * plan.daysOfWeek.length,
    fulfillmentMethod: fulfillmentMethod || plan.fulfillmentMethod,
    deliveryAddress:
      plan.fulfillmentMethod === 'Delivery' ? { coordinates: deliveryCoordinates, address: deliveryAddress || '' } : undefined,
  });

  res.status(201).json(sub);
});

// @desc  Customer: own subscriptions
// @route GET /api/subscriptions/my
const getMySubscriptions = asyncHandler(async (req, res) => {
  const subs = await CustomerSubscription.find({ user: req.user._id })
    .populate('plan', 'name pricePerWeek daysOfWeek')
    .populate('vendor', 'businessName')
    .sort({ createdAt: -1 });
  res.json(subs);
});

// @desc  Customer: skip a specific upcoming day (no order generated for it)
// @route PATCH /api/subscriptions/:id/skip
const skipDate = asyncHandler(async (req, res) => {
  const { date } = req.body;
  if (!date) {
    res.status(400);
    throw new Error('date is required');
  }
  const sub = await CustomerSubscription.findOne({ _id: req.params.id, user: req.user._id });
  if (!sub) {
    res.status(404);
    throw new Error('Subscription not found');
  }
  sub.skippedDates.push(new Date(date));
  await sub.save();
  res.json(sub);
});

// @desc  Customer: cancel a subscription (unused credits are simply not consumed further)
// @route PATCH /api/subscriptions/:id/cancel
const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await CustomerSubscription.findOne({ _id: req.params.id, user: req.user._id });
  if (!sub) {
    res.status(404);
    throw new Error('Subscription not found');
  }
  sub.status = 'cancelled';
  await sub.save();
  res.json(sub);
});

module.exports = {
  createPlan,
  getMyPlans,
  updatePlan,
  getVendorPlans,
  getRoster,
  initiateSubscriptionPayment,
  confirmSubscriptionPayment,
  getMySubscriptions,
  skipDate,
  cancelSubscription,
};
