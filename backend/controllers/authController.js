const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const generateToken = require('../utils/generateToken');
const { sendVerificationEmail } = require('../config/email');

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Generates a fresh verification token for a user, stores its hash, and
// emails (or, in mock mode, logs) the link. Shared by registration and the
// resend endpoint so both build the exact same link shape.
async function issueVerificationEmail(user) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationTokenHash = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  await user.save();

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verifyUrl = `${clientUrl}/verify-email?token=${rawToken}`;
  await sendVerificationEmail({ to: user.email, name: user.name, verifyUrl });
}

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

  await issueVerificationEmail(user);

  // No login token here on purpose — see loginUser: an unverified account
  // can't log in yet, so handing one out now would be a dead end anyway.
  res.status(201).json({
    message: 'Account created. Check your email to verify it before logging in.',
    email: user.email,
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

  // isApproved defaults to false on VendorProfile — verifying the owner's
  // email and being cleared by admin moderation are two separate gates,
  // deliberately: this one proves they own the inbox, that one proves the
  // kitchen itself is legitimate.
  await VendorProfile.create({
    user: user._id,
    businessName,
    fssaiLicense,
    kitchenLocation: { type: 'Point', coordinates: [longitude, latitude], address: address || '' },
  });

  await issueVerificationEmail(user);

  res.status(201).json({
    message: 'Account created. Check your email to verify it, then log in — your kitchen will also need admin approval before it goes live.',
    email: user.email,
  });
});

// @desc  Confirm an email verification token
// @route POST /api/auth/verify-email
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    res.status(400);
    throw new Error('token is required');
  }

  const user = await User.findOne({
    emailVerificationTokenHash: hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user) {
    res.status(400);
    throw new Error('This verification link is invalid or has expired');
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.json({ message: 'Email verified — you can log in now.', role: user.role });
});

// @desc  Re-send the verification email (e.g. the first one expired or got lost)
// @route POST /api/auth/resend-verification
const resendVerification = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) {
    res.status(400);
    throw new Error('email and role are required');
  }

  const user = await User.findOne({ email, role });
  // Same response whether or not the account exists, so this can't be used
  // to probe which emails are registered.
  if (user && !user.isEmailVerified) {
    await issueVerificationEmail(user);
  }
  res.json({ message: 'If that account exists and needs verifying, a new email is on its way.' });
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
  if (!user.isEmailVerified) {
    res.status(403);
    throw new Error('Please verify your email before logging in — check your inbox for the verification link.');
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
  if (!user.isEmailVerified) {
    res.status(403);
    throw new Error('Please verify your email before logging in — check your inbox for the verification link.');
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
  // Admin accounts are provisioned directly (seed/DB), never self-registered,
  // so there's no email-verification gate to check here.
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

module.exports = {
  registerUser,
  registerVendor,
  verifyEmail,
  resendVerification,
  loginUser,
  loginVendor,
  loginAdmin,
  getMe,
  updateMe,
};
