const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const PlatformSettings = require('../models/PlatformSettings');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { notify } = require('../services/notify');
const { sendVendorApprovalEmail, sendVendorSuspensionEmail } = require('../config/email');

// @desc  List every vendor, any status — the full oversight view (pending
//        queue below is just the "needs a first decision" subset of this)
// @route GET /api/admin/vendors
const getAllVendors = asyncHandler(async (req, res) => {
  const vendors = await VendorProfile.find({}).populate('user', 'name email phone').sort({ createdAt: -1 });
  res.json(vendors);
});

// @desc  Full drill-down on one vendor: their menu, per-item units sold and
//        revenue, and platform-vs-vendor earnings — the admin's "open the
//        restaurant and see everything" view.
// @route GET /api/admin/vendors/:id/details
const getVendorDetails = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findById(req.params.id).populate('user', 'name email phone');
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  const menu = await Product.find({ vendor: vendor._id }).sort({ createdAt: -1 });

  // "Sold" is scoped to paid orders — same population the GMV/commission
  // figures below are drawn from, so the item table and the totals agree
  // with each other. (Matches getOverview's existing paymentStatus: 'paid'
  // convention — a cancelled-after-payment order isn't excluded here any
  // more than it is there, since refunds aren't modeled yet.)
  const orders = await Order.find({ vendor: vendor._id, paymentStatus: 'paid' }).sort({ createdAt: -1 });

  const itemStatsByProduct = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const key = String(item.product);
      if (!itemStatsByProduct[key]) {
        itemStatsByProduct[key] = { productId: item.product, itemName: item.itemName, quantitySold: 0, revenue: 0 };
      }
      itemStatsByProduct[key].quantitySold += item.quantity;
      itemStatsByProduct[key].revenue += item.unitPrice * item.quantity;
    });
  });
  const itemStats = Object.values(itemStatsByProduct).sort((a, b) => b.quantitySold - a.quantitySold);

  const completedOrders = orders.filter((o) => o.status === 'Completed');
  const gmv = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const commissionCollected = orders.reduce((sum, o) => sum + o.platformCommissionAmount, 0);
  const netPayout = completedOrders.reduce((sum, o) => sum + o.vendorPayoutAmount, 0);

  res.json({
    vendor,
    menu,
    itemStats,
    earnings: {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      gmv,
      commissionCollected,
      netPayout,
      avgOrderValue: orders.length ? Math.round(gmv / orders.length) : 0,
    },
  });
});

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

  // Respond as soon as the actual action (the thing the admin asked for) has
  // succeeded — a downstream notify()/email failure must never turn a
  // successful approval into an error response. This is exactly how a bad
  // Notification enum value once did (see suspendVendor's history).
  res.json(vendor);

  const io = req.app.get('io');
  notify(io, {
    userId: vendor.user,
    type: 'vendor_approval',
    title: 'Your kitchen is approved!',
    body: `${vendor.businessName} is now live and visible to customers.`,
  }).catch((err) => console.error('[notify] Failed to create vendor_approval notification:', err.message));

  User.findById(vendor.user)
    .select('name email')
    .then((owner) => {
      if (!owner) return;
      return sendVendorApprovalEmail({ to: owner.email, name: owner.name, businessName: vendor.businessName, approved: true });
    })
    .catch((err) => console.error('[email] Failed to send approval email:', err.message));
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

  res.json(vendor);

  const io = req.app.get('io');
  notify(io, {
    userId: vendor.user,
    type: 'vendor_approval',
    title: 'Kitchen application needs attention',
    body: req.body.reason || 'Your kitchen listing was not approved. Please check your FSSAI license and details.',
  }).catch((err) => console.error('[notify] Failed to create vendor_approval notification:', err.message));

  User.findById(vendor.user)
    .select('name email')
    .then((owner) => {
      if (!owner) return;
      return sendVendorApprovalEmail({
        to: owner.email,
        name: owner.name,
        businessName: vendor.businessName,
        approved: false,
        reason: req.body.reason,
      });
    })
    .catch((err) => console.error('[email] Failed to send rejection email:', err.message));
});

// @desc  Pause an already-approved vendor at any point — separate override
//        from approve/reject, and from the vendor's own isOpen toggle (which
//        they'd otherwise just be able to flip back themselves)
// @route POST /api/admin/vendors/:id/suspend
const suspendVendor = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findById(req.params.id);
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  vendor.isSuspendedByAdmin = true;
  vendor.suspensionReason = req.body.reason || '';
  await vendor.save();

  res.json(vendor);

  const io = req.app.get('io');
  notify(io, {
    userId: vendor.user,
    type: 'vendor_suspension',
    title: 'Your kitchen has been paused',
    body: req.body.reason || `${vendor.businessName} has been paused by HomeBites.`,
  }).catch((err) => console.error('[notify] Failed to create vendor_suspension notification:', err.message));

  User.findById(vendor.user)
    .select('name email')
    .then((owner) => {
      if (!owner) return;
      return sendVendorSuspensionEmail({
        to: owner.email,
        name: owner.name,
        businessName: vendor.businessName,
        suspended: true,
        reason: req.body.reason,
      });
    })
    .catch((err) => console.error('[email] Failed to send suspension email:', err.message));
});

// @desc  Resume a previously-paused vendor
// @route POST /api/admin/vendors/:id/unsuspend
const unsuspendVendor = asyncHandler(async (req, res) => {
  const vendor = await VendorProfile.findById(req.params.id);
  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }
  vendor.isSuspendedByAdmin = false;
  vendor.suspensionReason = '';
  await vendor.save();

  res.json(vendor);

  const io = req.app.get('io');
  notify(io, {
    userId: vendor.user,
    type: 'vendor_suspension',
    title: 'Your kitchen is active again',
    body: `${vendor.businessName} has been resumed and is visible to customers again.`,
  }).catch((err) => console.error('[notify] Failed to create vendor_suspension notification:', err.message));

  User.findById(vendor.user)
    .select('name email')
    .then((owner) => {
      if (!owner) return;
      return sendVendorSuspensionEmail({ to: owner.email, name: owner.name, businessName: vendor.businessName, suspended: false });
    })
    .catch((err) => console.error('[email] Failed to send resume email:', err.message));
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

module.exports = {
  getAllVendors,
  getVendorDetails,
  getPendingVendors,
  approveVendor,
  rejectVendor,
  suspendVendor,
  unsuspendVendor,
  getSettings,
  updateSettings,
  getOverview,
};
