const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const PlatformSettings = require('../models/PlatformSettings');
const Order = require('../models/Order');
const { notify } = require('../services/notify');
const { sendVendorApprovalEmail } = require('../config/email');

// @desc  List vendors awaiting approval (excludes ones already rejected —
//        otherwise a rejected vendor looks identical to a fresh, never-
//        reviewed one and never leaves this queue)
// @route GET /api/admin/vendors/pending
const getPendingVendors = asyncHandler(async (req, res) => {
  const vendors = await VendorProfile.find({ isApproved: false, rejectedAt: null })
    .populate('user', 'name email phone')
    .sort({ createdAt: 1 });
  res.json(vendors);
});

// @desc  Approve a vendor — it becomes visible in customer discovery and can take orders
// @route POST /api/admin/vendors/:id/approve
const approveVendor = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findById(req.params.id);
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  vendor.isApproved = true;
  vendor.rejectedAt = null; // clears a prior rejection, in case this is a re-review
  await vendor.save();

  const io = req.app.get('io');
  await notify(io, {
    userId: vendor.user,
    type: 'vendor_approval',
    title: 'Your kitchen is approved!',
    body: `${vendor.businessName} is now live and visible to customers.`,
  });

  // Fire-and-forget, same reasoning as registration's verification email —
  // an approval action shouldn't hang or fail on a slow/broken mail send,
  // and the in-app notification above already covers the case where the
  // vendor happens to be logged in right now.
  const owner = await User.findById(vendor.user).select('name email');
  if (owner) {
    sendVendorApprovalEmail({ to: owner.email, name: owner.name, businessName: vendor.businessName, approved: true }).catch((err) =>
      console.error(`[email] Failed to send approval email to ${owner.email}:`, err.message)
    );
  }

  res.json(vendor);
});

// @desc  Reject a vendor's application (kept in the system, just not approved)
// @route POST /api/admin/vendors/:id/reject
const rejectVendor = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findById(req.params.id);
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  vendor.isApproved = false;
  vendor.isOpen = false;
  vendor.rejectedAt = new Date();
  await vendor.save();

  const io = req.app.get('io');
  await notify(io, {
    userId: vendor.user,
    type: 'vendor_approval',
    title: 'Kitchen application needs attention',
    body: req.body.reason || 'Your kitchen listing was not approved. Please check your FSSAI license and details.',
  });

  const owner = await User.findById(vendor.user).select('name email');
  if (owner) {
    sendVendorApprovalEmail({
      to: owner.email,
      name: owner.name,
      businessName: vendor.businessName,
      approved: false,
      reason: req.body.reason,
    }).catch((err) => console.error(`[email] Failed to send rejection email to ${owner.email}:`, err.message));
  }

  res.json(vendor);
});

// @desc  Read platform-wide settings (delivery rollout, commission rates)
// @route GET /api/admin/settings
const getSettings = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.getSingleton();
  res.json(settings);
});

// @desc  Update platform-wide settings
// @route PATCH /api/admin/settings
const updateSettings = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.getSingleton();
  const { deliveryRolloutEnabled, platformCommissionRateFree, platformCommissionRatePro, proSubscriptionPricePerMonth } = req.body;

  if (deliveryRolloutEnabled !== undefined) settings.deliveryRolloutEnabled = deliveryRolloutEnabled;
  if (platformCommissionRateFree !== undefined) settings.platformCommissionRateFree = platformCommissionRateFree;
  if (platformCommissionRatePro !== undefined) settings.platformCommissionRatePro = platformCommissionRatePro;
  if (proSubscriptionPricePerMonth !== undefined) settings.proSubscriptionPricePerMonth = proSubscriptionPricePerMonth;

  await settings.save();
  res.json(settings);
});

// @desc  Platform-wide GMV/commission overview — the payout-ledger view a
//        real business needs to know what it earned and what it owes vendors.
// @route GET /api/admin/overview
const getOverview = asyncHandler(async (req, res) => {
  const orders = await Order.find({ paymentStatus: 'paid' });
  const gmv = orders.reduce((s, o) => s + o.totalAmount, 0);
  const commissionCollected = orders.reduce((s, o) => s + o.platformCommissionAmount, 0);
  const vendorPayoutsOwed = orders
    .filter((o) => o.status === 'Completed')
    .reduce((s, o) => s + o.vendorPayoutAmount, 0);
  const totalVendors = await VendorProfile.countDocuments();
  const pendingVendors = await VendorProfile.countDocuments({ isApproved: false });
  const proVendors = await VendorProfile.countDocuments({ subscriptionPlan: 'pro' });

  res.json({
    totalOrders: orders.length,
    gmv,
    commissionCollected,
    vendorPayoutsOwed,
    totalVendors,
    pendingVendors,
    proVendors,
  });
});

module.exports = { getPendingVendors, approveVendor, rejectVendor, getSettings, updateSettings, getOverview };
