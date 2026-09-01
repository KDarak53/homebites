const express = require('express');
const {
  registerUser,
  registerVendor,
  verifyEmail,
  resendVerification,
  loginUser,
  loginVendor,
  loginAdmin,
  getMe,
  updateMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerUser);
router.post('/register-vendor', registerVendor);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', loginUser);
router.post('/login-vendor', loginVendor);
router.post('/login-admin', loginAdmin);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);

module.exports = router;
