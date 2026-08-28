const express = require('express');
const {
  getPendingVendors,
  approveVendor,
  rejectVendor,
  getSettings,
  updateSettings,
  getOverview,
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(protect, requireRole('admin'));

router.get('/vendors/pending', getPendingVendors);
router.post('/vendors/:id/approve', approveVendor);
router.post('/vendors/:id/reject', rejectVendor);
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.get('/overview', getOverview);

module.exports = router;
