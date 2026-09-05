const express = require('express');
const {
  getNearbyVendors,
  getVendorById,
  getMyVendorProfile,
  updateFulfillmentSettings,
  resubmitForApproval,
  getVendorAnalytics,
  initiateUpgrade,
  confirmUpgrade,
} = require('../controllers/vendorController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', getNearbyVendors);
router.get('/me/profile', protect, requireRole('vendor'), getMyVendorProfile);
router.patch('/me/settings', protect, requireRole('vendor'), updateFulfillmentSettings);
router.post('/me/resubmit', protect, requireRole('vendor'), resubmitForApproval);
router.get('/me/analytics', protect, requireRole('vendor'), getVendorAnalytics);
router.post('/me/upgrade/initiate', protect, requireRole('vendor'), initiateUpgrade);
router.post('/me/upgrade/confirm', protect, requireRole('vendor'), confirmUpgrade);
router.get('/:id', getVendorById);

module.exports = router;
