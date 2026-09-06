const express = require('express');
const {
  getMenuByVendor,
  getMyMenu,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/vendor/:vendorId', getMenuByVendor);
router.get('/me', protect, requireRole('vendor'), getMyMenu);
router.post('/', protect, requireRole('vendor'), createProduct);
router.patch('/:id', protect, requireRole('vendor'), updateProduct);
router.delete('/:id', protect, requireRole('vendor'), deleteProduct);

module.exports = router;
