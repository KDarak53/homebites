const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const generateToken = require('../utils/generateToken');

// @desc  Register a customer
// @route POST /api/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, longitude, latitude, address } = req.body;

  // Scoped to role: this email may already have a separate vendor account —
  // that's fine, they're independent identities.
  const exists = await User.findOne({ email, role: 'customer' });
  if (exists) {
    res.status(400);
    throw new Error('A customer account with this email already exists');
  }

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: 'customer',
    location: {
      type: 'Point',
      coordinates: [longitude ?? 0, latitude ?? 0],
      address: address || '',
    },
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  });
});

// @desc  Register a vendor (creates User + VendorProfile)
// @route POST /api/auth/register-vendor
const registerVendor = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    businessName,
    fssaiLicense,
    longitude,
    latitude,
    address,
  } = req.body;

  if (!businessName || !fssaiLicense || longitude == null || latitude == null) {
    res.status(400);
    throw new Error('businessName, fssaiLicense and kitchen coordinates are required');
  }

  const exists = await User.findOne({ email, role: 'vendor' });
  if (exists) {
    res.status(400);
    throw new Error('A vendor account with this email already exists');
  }

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: 'vendor',
    location: { type: 'Point', coordinates: [longitude, latitude], address: address || '' },
  });

  const vendorProfile = await VendorProfile.create({
    user: user._id,
    businessName,
    fssaiLicense,
    kitchenLocation: { type: 'Point', coordinates: [longitude, latitude], address: address || '' },
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    vendorProfileId: vendorProfile._id,
    token: generateToken(user._id, user.role),
  });
});

// @desc  Login as a customer
// @route POST /api/auth/login
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Scoped to role: an email that also has a vendor account must not log
  // into that account from the customer login form, and vice versa.
  const user = await User.findOne({ email, role: 'customer' }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  });
});

// @desc  Login as a vendor
// @route POST /api/auth/login-vendor
const loginVendor = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, role: 'vendor' }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  const vp = await VendorProfile.findOne({ user: user._id }).select('_id');

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    vendorProfileId: vp?._id,
    token: generateToken(user._id, user.role),
  });
});

// @desc  Login as an admin
// @route POST /api/auth/login-admin
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, role: 'admin' }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  });
});

// @desc  Get current logged-in user
// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// @desc  Update current user's own profile (name, phone, default location)
// @route PATCH /api/auth/me
const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { name, phone, longitude, latitude, address } = req.body;

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (longitude !== undefined) user.location.coordinates[0] = longitude;
  if (latitude !== undefined) user.location.coordinates[1] = latitude;
  if (address !== undefined) user.location.address = address;

  await user.save();
  res.json(user);
});

module.exports = { registerUser, registerVendor, loginUser, loginVendor, loginAdmin, getMe, updateMe };
