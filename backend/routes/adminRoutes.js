const express = require('express');
const {
  getAllVendors,
  getVendorDetails,
  getItemHistory,
  getPendingVendors,
  approveVendor,
  rejectVendor,
  requestVendorChanges,
  suspendVendor,
  unsuspendVendor,
  getSettings,
  updateSettings,
  getOverview,
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(protect, requireRole('admin'));

router.get('/vendors', getAllVendors);
router.get('/vendors/pending', getPendingVendors);
router.get('/vendors/:id/details', getVendorDetails);
router.get('/vendors/:vendorId/items/:productId/history', getItemHistory);
router.post('/vendors/:id/approve', approveVendor);
router.post('/vendors/:id/reject', rejectVendor);
router.post('/vendors/:id/request-changes', requestVendorChanges);
router.post('/vendors/:id/suspend', suspendVendor);
router.post('/vendors/:id/unsuspend', unsuspendVendor);
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.get('/overview', getOverview);

module.exports = router;
