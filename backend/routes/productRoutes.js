const express = require('express');
const {
  getMenuByVendor,
  getMyMenu,
  createProduct,
  updateProduct,
  openNextBatch,
  deleteProduct,
} = require('../controllers/productController');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/vendor/:vendorId', getMenuByVendor);
router.get('/me', protect, requireRole('vendor'), getMyMenu);
router.post('/', protect, requireRole('vendor'), createProduct);
router.patch('/:id', protect, requireRole('vendor'), updateProduct);
router.post('/:id/open-next-batch', protect, requireRole('vendor'), openNextBatch);
router.delete('/:id', protect, requireRole('vendor'), deleteProduct);

module.exports = router;
