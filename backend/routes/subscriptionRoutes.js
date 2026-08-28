const express = require('express');
const {
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
} = require('../controllers/subscriptionController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

// Plans (vendor-authored)
router.post('/plans', protect, requireRole('vendor'), createPlan);
router.get('/plans/me', protect, requireRole('vendor'), getMyPlans);
router.patch('/plans/:id', protect, requireRole('vendor'), updatePlan);
router.get('/plans/vendor/:vendorId', getVendorPlans);

// Vendor roster
router.get('/vendor/roster', protect, requireRole('vendor'), getRoster);

// Customer subscribe / manage
router.post('/initiate', protect, requireRole('customer'), initiateSubscriptionPayment);
router.post('/confirm', protect, requireRole('customer'), confirmSubscriptionPayment);
router.get('/my', protect, requireRole('customer'), getMySubscriptions);
router.patch('/:id/skip', protect, requireRole('customer'), skipDate);
router.patch('/:id/cancel', protect, requireRole('customer'), cancelSubscription);

module.exports = router;
