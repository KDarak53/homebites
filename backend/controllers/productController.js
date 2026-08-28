const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const VendorProfile = require('../models/VendorProfile');

const getOwnVendorProfileOr403 = async (userId) => {
  const vendor = await VendorProfile.findOne({ user: userId });
  if (!vendor) {
    const err = new Error('Vendor profile not found');
    err.statusCode = 404;
    throw err;
  }
  return vendor;
};

// @desc  Public: list a vendor's menu
// @route GET /api/products/vendor/:vendorId
const getMenuByVendor = asyncHandler(async (req, res) => {
  const products = await Product.find({ vendor: req.params.vendorId, isActive: true }).sort({
    createdAt: -1,
  });

  // orderability flag mirrors the "Add to Cart" disable rule:
  // available if currentQuantity > 0 OR a pre-book window is still open.
  const withAvailability = products.map((p) => {
    const obj = p.toObject();
    obj.canOrderDirect = p.availableForDirectOrder && p.currentQuantity > 0;
    obj.canPrebook = p.availableForPrebook && obj.isPrebookOpen;
    obj.isOrderable = obj.canOrderDirect || obj.canPrebook;
    return obj;
  });

  res.json(withAvailability);
});

// @desc  Vendor: list own menu (includes inactive items)
// @route GET /api/products/me
const getMyMenu = asyncHandler(async (req, res) => {
  const vendor = await getOwnVendorProfileOr403(req.user._id);
  const products = await Product.find({ vendor: vendor._id }).sort({ createdAt: -1 });
  res.json(products);
});

// @desc  Vendor: create menu item
// @route POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const vendor = await getOwnVendorProfileOr403(req.user._id);

  const { itemName, description, isVeg, price, maxQuantityPerBatch, imageUrl, availableForDirectOrder, availableForPrebook, prebookCutoffTime, nextBatchQuantity } =
    req.body;

  const product = await Product.create({
    vendor: vendor._id,
    itemName,
    description,
    isVeg,
    price,
    imageUrl,
    maxQuantityPerBatch,
    currentQuantity: maxQuantityPerBatch,
    availableForDirectOrder,
    availableForPrebook,
    prebookCutoffTime,
    nextBatchQuantity: nextBatchQuantity || 0,
  });

  res.status(201).json(product);
});

// @desc  Vendor: update menu item (price, veg status, active, batch qty, cutoff timer)
// @route PATCH /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const vendor = await getOwnVendorProfileOr403(req.user._id);
  const product = await Product.findOne({ _id: req.params.id, vendor: vendor._id });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const allowedFields = [
    'itemName',
    'description',
    'isVeg',
    'price',
    'imageUrl',
    'maxQuantityPerBatch',
    'currentQuantity',
    'availableForDirectOrder',
    'availableForPrebook',
    'prebookCutoffTime',
    'nextBatchQuantity',
    'isActive',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  });

  await product.save();
  res.json(product);
});

// @desc  Vendor: open a new batch cycle (rolls nextBatchQuantity into currentQuantity)
// @route POST /api/products/:id/open-next-batch
const openNextBatch = asyncHandler(async (req, res) => {
  const vendor = await getOwnVendorProfileOr403(req.user._id);
  const product = await Product.findOne({ _id: req.params.id, vendor: vendor._id });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  product.currentQuantity = product.nextBatchQuantity || product.maxQuantityPerBatch;
  product.nextBatchQuantity = 0;
  product.prebookCutoffTime = req.body.prebookCutoffTime || null;
  await product.save();

  res.json(product);
});

// @desc  Vendor: delete menu item
// @route DELETE /api/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const vendor = await getOwnVendorProfileOr403(req.user._id);
  const product = await Product.findOneAndDelete({ _id: req.params.id, vendor: vendor._id });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json({ message: 'Product deleted' });
});

module.exports = {
  getMenuByVendor,
  getMyMenu,
  createProduct,
  updateProduct,
  openNextBatch,
  deleteProduct,
};
