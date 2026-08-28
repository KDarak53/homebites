const express = require('express');
const {
  initiatePayment,
  confirmPayment,
  getMyOrders,
  getVendorDashboard,
  updateOrderStatus,
  verifyPickup,
  rateOrder,
} = require('../controllers/orderController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/initiate', protect, requireRole('customer'), initiatePayment);
router.post('/confirm', protect, requireRole('customer'), confirmPayment);
router.get('/my', protect, requireRole('customer'), getMyOrders);
router.post('/:id/rate', protect, requireRole('customer'), rateOrder);

router.get('/vendor/dashboard', protect, requireRole('vendor'), getVendorDashboard);
router.post('/vendor/verify-pickup', protect, requireRole('vendor'), verifyPickup);
router.patch('/:id/status', protect, requireRole('vendor'), updateOrderStatus);

module.exports = router;
