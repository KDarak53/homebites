require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const VendorProfile = require('../models/VendorProfile');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Demo base location — matches the default shown on the frontend's location
// fallback so "nearby vendor" search works out of the box without needing
// real browser geolocation to line up with the seeded data. Override with:
//   node utils/seed.js <latitude> <longitude> [cityLabel]
const [argLat, argLng, argCity] = process.argv.slice(2);
const BASE = {
  latitude: argLat ? parseFloat(argLat) : 18.5204,
  longitude: argLng ? parseFloat(argLng) : 73.8567,
  city: argCity || 'Pune',
};

const HOURS = 60 * 60 * 1000;

// Each vendor's coords are BASE plus a small fixed offset (degrees), so the
// whole cluster moves together when BASE changes — offsets chosen to land
// roughly 1.5-8.5km away in different directions.
const OFFSETS = [
  { dLat: 0.0135, dLng: 0.0048, area: 'Lake Garden Colony' }, // ~1.6km NE
  { dLat: -0.018, dLng: 0.0285, area: 'East Market Road' }, // ~3.6km SE
  { dLat: 0.036, dLng: -0.0095, area: 'North Avenue' }, // ~4.1km N
  { dLat: -0.027, dLng: -0.019, area: 'Riverside Layout' }, // ~3.6km SW
  { dLat: 0.06, dLng: 0.06, area: 'Greenfield Nagar' }, // ~8.5km NE
];
const coordsFor = (i) => [
  +(BASE.longitude + OFFSETS[i].dLng).toFixed(4),
  +(BASE.latitude + OFFSETS[i].dLat).toFixed(4),
];
const addressFor = (i) => `${OFFSETS[i].area}, ${BASE.city}`;

const vendors = [
  {
    email: 'maharashtrian@homebites.test',
    businessName: 'Maharashtrian Ghar',
    fssaiLicense: 'FSSAI11223344001',
    description: 'Home-style Maharashtrian thalis and snacks.',
    coords: coordsFor(0),
    address: addressFor(0),
    isVegOnly: true,
    deliveryEnabled: true,
    maxDeliveryRadiusKm: 6,
    deliveryFee: 25,
    averageRating: 4.5,
    ratingCount: 62,
    totalOrdersCompleted: 210,
    items: [
      { itemName: 'Misal Pav', price: 80, maxQuantityPerBatch: 25, currentQuantity: 14 },
      { itemName: 'Poha', price: 50, maxQuantityPerBatch: 30, currentQuantity: 30 },
      { itemName: 'Puran Poli', price: 60, maxQuantityPerBatch: 15, currentQuantity: 0 },
    ],
  },
  {
    email: 'punjabitadka@homebites.test',
    businessName: 'Punjabi Tadka',
    fssaiLicense: 'FSSAI11223344002',
    description: 'North Indian comfort food, made fresh daily.',
    coords: coordsFor(1),
    address: addressFor(1),
    isVegOnly: false,
    deliveryEnabled: true,
    maxDeliveryRadiusKm: 8,
    deliveryFee: 35,
    averageRating: 4.2,
    ratingCount: 40,
    totalOrdersCompleted: 95,
    items: [
      { itemName: 'Butter Chicken', isVeg: false, price: 220, maxQuantityPerBatch: 20, currentQuantity: 6 },
      { itemName: 'Dal Makhani', price: 140, maxQuantityPerBatch: 20, currentQuantity: 20 },
      { itemName: 'Tandoori Roti (2 pc)', price: 40, maxQuantityPerBatch: 50, currentQuantity: 50 },
    ],
  },
  {
    email: 'southindian@homebites.test',
    businessName: 'South Indian Delight',
    fssaiLicense: 'FSSAI11223344003',
    description: 'Authentic Udupi-style breakfast and tiffin.',
    coords: coordsFor(2),
    address: addressFor(2),
    isVegOnly: true,
    deliveryEnabled: false,
    maxDeliveryRadiusKm: 0,
    deliveryFee: 0,
    averageRating: 4.7,
    ratingCount: 130,
    totalOrdersCompleted: 340,
    items: [
      { itemName: 'Masala Dosa', price: 70, maxQuantityPerBatch: 40, currentQuantity: 22 },
      { itemName: 'Idli Sambar (4 pc)', price: 60, maxQuantityPerBatch: 40, currentQuantity: 0 },
      { itemName: 'Pongal', price: 55, maxQuantityPerBatch: 20, currentQuantity: 9 },
    ],
  },
  {
    email: 'bengalibhog@homebites.test',
    businessName: 'Bengali Bhog',
    fssaiLicense: 'FSSAI11223344004',
    description: 'Bengali fish curry and biryani, pre-book a day ahead for best batches.',
    coords: coordsFor(3),
    address: addressFor(3),
    isVegOnly: false,
    deliveryEnabled: true,
    maxDeliveryRadiusKm: 5,
    deliveryFee: 30,
    averageRating: 4.0,
    ratingCount: 18,
    totalOrdersCompleted: 45,
    items: [
      { itemName: 'Chicken Biryani', isVeg: false, price: 180, maxQuantityPerBatch: 20, currentQuantity: 3,
        availableForPrebook: true, prebookCutoffTime: new Date(Date.now() + 20 * HOURS), nextBatchQuantity: 15 },
      { itemName: 'Fish Curry', isVeg: false, price: 200, maxQuantityPerBatch: 15, currentQuantity: 8 },
    ],
  },
  {
    email: 'gujaratirasoi@homebites.test',
    businessName: 'Gujarati Rasoi',
    fssaiLicense: 'FSSAI11223344005',
    description: 'Sweet, savoury and everything in between — pure veg Gujarati kitchen.',
    coords: coordsFor(4),
    address: addressFor(4),
    isVegOnly: true,
    deliveryEnabled: true,
    maxDeliveryRadiusKm: 10,
    deliveryFee: 40,
    averageRating: 4.8,
    ratingCount: 210,
    totalOrdersCompleted: 500,
    items: [
      { itemName: 'Dhokla (6 pc)', price: 50, maxQuantityPerBatch: 30, currentQuantity: 30 },
      { itemName: 'Thepla (4 pc)', price: 45, maxQuantityPerBatch: 30, currentQuantity: 17 },
      { itemName: 'Undhiyu', price: 120, maxQuantityPerBatch: 15, currentQuantity: 0,
        availableForDirectOrder: false, availableForPrebook: true,
        prebookCutoffTime: new Date(Date.now() + 15 * HOURS), nextBatchQuantity: 15 },
    ],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Clearing existing demo data...');

  const emails = ['demo.customer@homebites.test', 'admin@homebites.test', ...vendors.map((v) => v.email)];
  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingUserIds = existingUsers.map((u) => u._id);
  const existingVendorProfiles = await VendorProfile.find({ user: { $in: existingUserIds } }).select('_id');
  const existingVendorProfileIds = existingVendorProfiles.map((v) => v._id);

  await Order.deleteMany({ vendor: { $in: existingVendorProfileIds } });
  await Product.deleteMany({ vendor: { $in: existingVendorProfileIds } });
  await VendorProfile.deleteMany({ _id: { $in: existingVendorProfileIds } });
  await User.deleteMany({ _id: { $in: existingUserIds } });

  await User.create({
    name: 'Demo Customer',
    email: 'demo.customer@homebites.test',
    phone: '9800000000',
    password: 'password123',
    role: 'customer',
    location: { type: 'Point', coordinates: [BASE.longitude, BASE.latitude], address: `Demo address, ${BASE.city}` },
  });
  console.log('Created demo customer: demo.customer@homebites.test / password123');

  await User.create({
    name: 'Platform Admin',
    email: 'admin@homebites.test',
    phone: '9800000099',
    password: 'password123',
    role: 'admin',
    location: { type: 'Point', coordinates: [BASE.longitude, BASE.latitude], address: `Admin, ${BASE.city}` },
  });
  console.log('Created admin: admin@homebites.test / password123');
  console.log(`Seeding around ${BASE.city} (${BASE.latitude}, ${BASE.longitude})`);

  for (const v of vendors) {
    const user = await User.create({
      name: `${v.businessName} Owner`,
      email: v.email,
      phone: '98' + String(Math.floor(10000000 + Math.random() * 89999999)),
      password: 'password123',
      role: 'vendor',
      location: { type: 'Point', coordinates: v.coords, address: v.address },
    });

    const profile = await VendorProfile.create({
      user: user._id,
      businessName: v.businessName,
      fssaiLicense: v.fssaiLicense,
      description: v.description,
      kitchenLocation: { type: 'Point', coordinates: v.coords, address: v.address },
      isVegOnly: v.isVegOnly,
      deliveryEnabled: v.deliveryEnabled,
      maxDeliveryRadiusKm: v.maxDeliveryRadiusKm,
      deliveryFee: v.deliveryFee,
      averageRating: v.averageRating,
      ratingCount: v.ratingCount,
      totalOrdersCompleted: v.totalOrdersCompleted,
      isApproved: true,
      isOpen: true,
    });

    for (const item of v.items) {
      await Product.create({
        vendor: profile._id,
        itemName: item.itemName,
        isVeg: item.isVeg ?? true,
        price: item.price,
        maxQuantityPerBatch: item.maxQuantityPerBatch,
        currentQuantity: item.currentQuantity,
        availableForDirectOrder: item.availableForDirectOrder ?? true,
        availableForPrebook: item.availableForPrebook ?? false,
        prebookCutoffTime: item.prebookCutoffTime ?? null,
        nextBatchQuantity: item.nextBatchQuantity ?? 0,
      });
    }

    console.log(`Created vendor: ${v.businessName} (${v.email} / password123)`);
  }

  console.log('\nSeed complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
