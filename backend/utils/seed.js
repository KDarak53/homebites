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

// Real, verified food photos (Unsplash) — reused across a few items each
// rather than uploaded files, since this seeds a live deployment where
// local-disk uploads wouldn't survive a redeploy anyway.
const img = (id) => `https://images.unsplash.com/photo-${id}?w=500&q=75&auto=format&fit=crop`;
const PHOTO = {
  curry: img('1631452180519-c014fe946bc7'),
  biryani: img('1589302168068-964664d93dc0'),
  paneerTikka: img('1567188040759-fb8a883dc6d8'),
  samosa: img('1601050690597-df0568f70950'),
  curryRiceOverhead: img('1585937421612-70a008356fbe'),
  curryPan: img('1596797038530-2c107229654b'),
  curryOverhead: img('1631292784640-2b24be784d5d'),
  biryaniRaita: img('1642821373181-696a54913e93'),
  thali: img('1567337710282-00832b415979'),
  pavBhaji: img('1626132647523-66f5bf380027'),
  kebab: img('1599487488170-d11ec9c172f0'),
  pulao: img('1512058564366-18510be2db19'),
  halwa: img('1517244683847-7456b63c5969'),
  pavRollsCurry: img('1606491956689-2ea866880c84'),
  biryaniDark: img('1630851840633-f96999247032'),
  dosa: img('1668236543090-82eba5ee5976'),
  uttapam: img('1662174485500-6d32a13c060e'),
  dosaChutneys: img('1606888476625-ddf0393a172d'),
  idli: img('1589301760014-d929f3979dbc'),
  vegStew: img('1559561723-c3f4195835db'),
  dhokla: img('1714799263291-272975db795a'),
  chaatPlatter: img('1586357507341-3fbe59f2a5d9'),
};

// Each vendor's coords are BASE plus a small fixed offset (degrees), so the
// whole cluster moves together when BASE changes — offsets chosen to land
// roughly 1.5-9km away in different directions.
const OFFSETS = [
  { dLat: 0.0135, dLng: 0.0048, area: 'Lake Garden Colony' }, // ~1.6km NE
  { dLat: -0.018, dLng: 0.0285, area: 'East Market Road' }, // ~3.6km SE
  { dLat: 0.036, dLng: -0.0095, area: 'North Avenue' }, // ~4.1km N
  { dLat: -0.027, dLng: -0.019, area: 'Riverside Layout' }, // ~3.6km SW
  { dLat: 0.06, dLng: 0.06, area: 'Greenfield Nagar' }, // ~8.5km NE
  { dLat: -0.008, dLng: -0.045, area: 'Harbor View Street' }, // ~4.7km W
  { dLat: 0.022, dLng: 0.038, area: 'Sunrise Boulevard' }, // ~4.9km NE
  { dLat: -0.045, dLng: 0.012, area: 'Old Fort Road' }, // ~5.1km S
  { dLat: 0.009, dLng: -0.07, area: 'Silver Sands Nagar' }, // ~7.1km W
  { dLat: -0.06, dLng: -0.04, area: 'Palm Grove Extension' }, // ~7.7km SW
];
const coordsFor = (i) => [
  +(BASE.longitude + OFFSETS[i].dLng).toFixed(4),
  +(BASE.latitude + OFFSETS[i].dLat).toFixed(4),
];
const addressFor = (i) => `${OFFSETS[i].area}, ${BASE.city}`;

// Smaller scatter for customers — they live a few streets away from the
// vendor cluster, not kilometers, so "distance to vendor" reads naturally.
const CUSTOMER_OFFSETS = [
  { dLat: 0, dLng: 0, area: null }, // the original demo customer, unchanged
  { dLat: 0.006, dLng: 0.01, area: 'Rose Garden Apartments' },
  { dLat: -0.009, dLng: 0.005, area: 'Cedar Heights' },
  { dLat: 0.012, dLng: -0.007, area: 'Maple Residency' },
  { dLat: -0.004, dLng: -0.013, area: 'Sunset Enclave' },
  { dLat: 0.018, dLng: 0.014, area: 'Willow Park' },
  { dLat: -0.015, dLng: 0.009, area: 'Orchid Towers' },
  { dLat: 0.003, dLng: -0.02, area: 'Palm Court' },
  { dLat: -0.011, dLng: -0.006, area: 'Silver Oak Residency' },
  { dLat: 0.008, dLng: 0.021, area: 'Birchwood Lane' },
];

const CUSTOMERS = [
  { name: 'Demo Customer', email: 'demo.customer@homebites.test', phone: '9800000000' },
  { name: 'Aarav Mehta', email: 'aarav.mehta@homebites.test', phone: '9800000001' },
  { name: 'Diya Sharma', email: 'diya.sharma@homebites.test', phone: '9800000002' },
  { name: 'Kabir Nair', email: 'kabir.nair@homebites.test', phone: '9800000003' },
  { name: 'Isha Reddy', email: 'isha.reddy@homebites.test', phone: '9800000004' },
  { name: 'Vihaan Iyer', email: 'vihaan.iyer@homebites.test', phone: '9800000005' },
  { name: 'Ananya Rao', email: 'ananya.rao@homebites.test', phone: '9800000006' },
  { name: 'Arjun Pillai', email: 'arjun.pillai@homebites.test', phone: '9800000007' },
  { name: 'Sara Khan', email: 'sara.khan@homebites.test', phone: '9800000008' },
  { name: 'Rohan Gupta', email: 'rohan.gupta@homebites.test', phone: '9800000009' },
];

// A couple of items per vendor showcase the pre-order window + collection
// window features: order window opens now and closes in ~20h, batch is
// ready for collection the evening after that.
const prebookTiming = () => ({
  availableForPrebook: true,
  prebookOpensAt: new Date(Date.now() - 1 * HOURS),
  prebookCutoffTime: new Date(Date.now() + 20 * HOURS),
  nextBatchQuantity: 15,
  collectionStartTime: new Date(Date.now() + 22 * HOURS),
  collectionEndTime: new Date(Date.now() + 24 * HOURS),
});

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
      { itemName: 'Misal Pav', price: 80, maxQuantityPerBatch: 25, currentQuantity: 14, imageUrl: PHOTO.pavBhaji },
      { itemName: 'Poha', price: 50, maxQuantityPerBatch: 30, currentQuantity: 30, imageUrl: PHOTO.pulao },
      { itemName: 'Puran Poli', price: 60, maxQuantityPerBatch: 15, currentQuantity: 0, imageUrl: PHOTO.halwa },
      { itemName: 'Sabudana Khichdi', price: 65, maxQuantityPerBatch: 20, currentQuantity: 12, imageUrl: PHOTO.curryOverhead },
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
      { itemName: 'Butter Chicken', isVeg: false, price: 220, maxQuantityPerBatch: 20, currentQuantity: 6, imageUrl: PHOTO.curry },
      { itemName: 'Dal Makhani', price: 140, maxQuantityPerBatch: 20, currentQuantity: 20, imageUrl: PHOTO.curryPan },
      { itemName: 'Tandoori Roti (2 pc)', price: 40, maxQuantityPerBatch: 50, currentQuantity: 50, imageUrl: PHOTO.pavRollsCurry },
      { itemName: 'Amritsari Chole', price: 130, maxQuantityPerBatch: 20, currentQuantity: 11, imageUrl: PHOTO.curryRiceOverhead },
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
      { itemName: 'Masala Dosa', price: 70, maxQuantityPerBatch: 40, currentQuantity: 22, imageUrl: PHOTO.dosa },
      { itemName: 'Idli Sambar (4 pc)', price: 60, maxQuantityPerBatch: 40, currentQuantity: 0, imageUrl: PHOTO.idli },
      { itemName: 'Pongal', price: 55, maxQuantityPerBatch: 20, currentQuantity: 9, imageUrl: PHOTO.pulao },
      { itemName: 'Onion Uttapam', price: 75, maxQuantityPerBatch: 25, currentQuantity: 16, imageUrl: PHOTO.uttapam },
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
      { itemName: 'Chicken Biryani', isVeg: false, price: 180, maxQuantityPerBatch: 20, currentQuantity: 3, imageUrl: PHOTO.biryaniRaita, ...prebookTiming() },
      { itemName: 'Fish Curry', isVeg: false, price: 200, maxQuantityPerBatch: 15, currentQuantity: 8, imageUrl: PHOTO.curryRiceOverhead },
      { itemName: 'Aloo Posto', price: 90, maxQuantityPerBatch: 20, currentQuantity: 20, imageUrl: PHOTO.curryOverhead },
      { itemName: 'Mishti Doi', price: 45, maxQuantityPerBatch: 25, currentQuantity: 25, imageUrl: PHOTO.halwa },
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
      { itemName: 'Dhokla (6 pc)', price: 50, maxQuantityPerBatch: 30, currentQuantity: 30, imageUrl: PHOTO.dhokla },
      { itemName: 'Thepla (4 pc)', price: 45, maxQuantityPerBatch: 30, currentQuantity: 17, imageUrl: PHOTO.pavRollsCurry },
      { itemName: 'Undhiyu', price: 120, maxQuantityPerBatch: 15, currentQuantity: 0, imageUrl: PHOTO.curryOverhead,
        availableForDirectOrder: false, ...prebookTiming() },
      { itemName: 'Khandvi', price: 55, maxQuantityPerBatch: 20, currentQuantity: 20, imageUrl: PHOTO.thali },
    ],
  },
  {
    email: 'keralakitchen@homebites.test',
    businessName: 'Kerala Kitchen',
    fssaiLicense: 'FSSAI11223344006',
    description: 'Coconut-forward Kerala home cooking — appams, stews and seafood.',
    coords: coordsFor(5),
    address: addressFor(5),
    isVegOnly: false,
    deliveryEnabled: true,
    maxDeliveryRadiusKm: 7,
    deliveryFee: 30,
    averageRating: 4.6,
    ratingCount: 88,
    totalOrdersCompleted: 175,
    items: [
      { itemName: 'Appam with Veg Stew', price: 95, maxQuantityPerBatch: 25, currentQuantity: 18, imageUrl: PHOTO.vegStew },
      { itemName: 'Kerala Fish Curry', isVeg: false, price: 190, maxQuantityPerBatch: 15, currentQuantity: 9, imageUrl: PHOTO.curryRiceOverhead },
      { itemName: 'Puttu & Kadala Curry', price: 85, maxQuantityPerBatch: 20, currentQuantity: 20, imageUrl: PHOTO.idli },
      { itemName: 'Chicken Ularthiyathu', isVeg: false, price: 210, maxQuantityPerBatch: 15, currentQuantity: 2, imageUrl: PHOTO.kebab, ...prebookTiming() },
    ],
  },
  {
    email: 'hyderabadihandi@homebites.test',
    businessName: 'Hyderabadi Handi',
    fssaiLicense: 'FSSAI11223344007',
    description: 'Slow-cooked Hyderabadi biryani and Nizami classics.',
    coords: coordsFor(6),
    address: addressFor(6),
    isVegOnly: false,
    deliveryEnabled: true,
    maxDeliveryRadiusKm: 9,
    deliveryFee: 40,
    averageRating: 4.4,
    ratingCount: 156,
    totalOrdersCompleted: 410,
    items: [
      { itemName: 'Hyderabadi Biryani', isVeg: false, price: 210, maxQuantityPerBatch: 30, currentQuantity: 13, imageUrl: PHOTO.biryani },
      { itemName: 'Chicken Haleem', isVeg: false, price: 160, maxQuantityPerBatch: 20, currentQuantity: 4, imageUrl: PHOTO.curryPan, ...prebookTiming() },
      { itemName: 'Mirchi ka Salan', price: 70, maxQuantityPerBatch: 25, currentQuantity: 25, imageUrl: PHOTO.curryOverhead },
      { itemName: 'Seekh Kebab (4 pc)', isVeg: false, price: 150, maxQuantityPerBatch: 20, currentQuantity: 10, imageUrl: PHOTO.kebab },
    ],
  },
  {
    email: 'rajasthanirasoi@homebites.test',
    businessName: 'Rajasthani Rasoi',
    fssaiLicense: 'FSSAI11223344008',
    description: 'Royal Rajasthani thalis — dal baati churma and desert-kitchen classics.',
    coords: coordsFor(7),
    address: addressFor(7),
    isVegOnly: true,
    deliveryEnabled: false,
    maxDeliveryRadiusKm: 0,
    deliveryFee: 0,
    averageRating: 4.6,
    ratingCount: 71,
    totalOrdersCompleted: 160,
    items: [
      { itemName: 'Dal Baati Churma', price: 140, maxQuantityPerBatch: 20, currentQuantity: 15, imageUrl: PHOTO.thali },
      { itemName: 'Gatte ki Sabzi', price: 100, maxQuantityPerBatch: 20, currentQuantity: 20, imageUrl: PHOTO.curryRiceOverhead },
      { itemName: 'Ker Sangri', price: 90, maxQuantityPerBatch: 15, currentQuantity: 7, imageUrl: PHOTO.curryOverhead },
      { itemName: 'Malpua (4 pc)', price: 75, maxQuantityPerBatch: 20, currentQuantity: 0, imageUrl: PHOTO.halwa,
        availableForDirectOrder: false, ...prebookTiming() },
    ],
  },
  {
    email: 'chettinadspice@homebites.test',
    businessName: 'Chettinad Spice Kitchen',
    fssaiLicense: 'FSSAI11223344009',
    description: 'Fiery Chettinad classics from a real Chettinad home kitchen.',
    coords: coordsFor(8),
    address: addressFor(8),
    isVegOnly: false,
    deliveryEnabled: true,
    maxDeliveryRadiusKm: 6,
    deliveryFee: 25,
    averageRating: 4.5,
    ratingCount: 98,
    totalOrdersCompleted: 260,
    items: [
      { itemName: 'Chettinad Chicken Curry', isVeg: false, price: 200, maxQuantityPerBatch: 20, currentQuantity: 7, imageUrl: PHOTO.curry },
      { itemName: 'Kothu Parotta', price: 110, maxQuantityPerBatch: 25, currentQuantity: 19, imageUrl: PHOTO.pavRollsCurry },
      { itemName: 'Mutton Chukka', isVeg: false, price: 240, maxQuantityPerBatch: 15, currentQuantity: 3, imageUrl: PHOTO.kebab, ...prebookTiming() },
      { itemName: 'Sambar Rice', price: 80, maxQuantityPerBatch: 25, currentQuantity: 25, imageUrl: PHOTO.pulao },
    ],
  },
  {
    email: 'mumbaichaat@homebites.test',
    businessName: 'Mumbai Chaat Corner',
    fssaiLicense: 'FSSAI11223344010',
    description: 'Street-style Mumbai chaat and snacks, made to order.',
    coords: coordsFor(9),
    address: addressFor(9),
    isVegOnly: true,
    deliveryEnabled: true,
    maxDeliveryRadiusKm: 5,
    deliveryFee: 20,
    averageRating: 4.3,
    ratingCount: 54,
    totalOrdersCompleted: 130,
    items: [
      { itemName: 'Pani Puri (6 pc)', price: 50, maxQuantityPerBatch: 40, currentQuantity: 28, imageUrl: PHOTO.chaatPlatter },
      { itemName: 'Bhel Puri', price: 55, maxQuantityPerBatch: 30, currentQuantity: 20, imageUrl: PHOTO.chaatPlatter },
      { itemName: 'Vada Pav (2 pc)', price: 40, maxQuantityPerBatch: 35, currentQuantity: 35, imageUrl: PHOTO.pavBhaji },
      { itemName: 'Sev Puri', price: 55, maxQuantityPerBatch: 25, currentQuantity: 0, imageUrl: PHOTO.samosa,
        availableForDirectOrder: false, ...prebookTiming() },
    ],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Clearing existing demo data...');

  const emails = [...CUSTOMERS.map((c) => c.email), 'admin@homebites.test', ...vendors.map((v) => v.email)];
  const existingUsers = await User.find({ email: { $in: emails } }).select('_id');
  const existingUserIds = existingUsers.map((u) => u._id);
  const existingVendorProfiles = await VendorProfile.find({ user: { $in: existingUserIds } }).select('_id');
  const existingVendorProfileIds = existingVendorProfiles.map((v) => v._id);

  await Order.deleteMany({ vendor: { $in: existingVendorProfileIds } });
  await Product.deleteMany({ vendor: { $in: existingVendorProfileIds } });
  await VendorProfile.deleteMany({ _id: { $in: existingVendorProfileIds } });
  await User.deleteMany({ _id: { $in: existingUserIds } });

  console.log(`\nSeeding around ${BASE.city} (${BASE.latitude}, ${BASE.longitude})\n`);

  const customerCreds = [];
  for (let i = 0; i < CUSTOMERS.length; i++) {
    const c = CUSTOMERS[i];
    const off = CUSTOMER_OFFSETS[i];
    const coords = [+(BASE.longitude + off.dLng).toFixed(4), +(BASE.latitude + off.dLat).toFixed(4)];
    const address = off.area ? `${off.area}, ${BASE.city}` : `Demo address, ${BASE.city}`;
    await User.create({
      name: c.name,
      email: c.email,
      phone: c.phone,
      password: 'password123',
      role: 'customer',
      isEmailVerified: true, // seeded accounts skip the real verification flow
      location: { type: 'Point', coordinates: coords, address },
    });
    customerCreds.push({ name: c.name, email: c.email });
  }
  console.log(`Created ${CUSTOMERS.length} customers (all password: password123):`);
  customerCreds.forEach((c) => console.log(`  ${c.name.padEnd(16)} ${c.email}`));

  await User.create({
    name: 'Platform Admin',
    email: 'admin@homebites.test',
    phone: '9800000099',
    password: 'password123',
    role: 'admin',
    isEmailVerified: true,
    location: { type: 'Point', coordinates: [BASE.longitude, BASE.latitude], address: `Admin, ${BASE.city}` },
  });
  console.log('\nCreated admin: admin@homebites.test / password123');

  const vendorCreds = [];
  for (const v of vendors) {
    const user = await User.create({
      name: `${v.businessName} Owner`,
      email: v.email,
      phone: '98' + String(Math.floor(10000000 + Math.random() * 89999999)),
      password: 'password123',
      role: 'vendor',
      isEmailVerified: true,
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
        imageUrl: item.imageUrl || '',
        maxQuantityPerBatch: item.maxQuantityPerBatch,
        currentQuantity: item.currentQuantity,
        availableForDirectOrder: item.availableForDirectOrder ?? true,
        availableForPrebook: item.availableForPrebook ?? false,
        prebookOpensAt: item.prebookOpensAt ?? null,
        prebookCutoffTime: item.prebookCutoffTime ?? null,
        nextBatchQuantity: item.nextBatchQuantity ?? 0,
        collectionStartTime: item.collectionStartTime ?? null,
        collectionEndTime: item.collectionEndTime ?? null,
      });
    }

    vendorCreds.push({ name: v.businessName, email: v.email, items: v.items.length });
  }
  console.log(`\nCreated ${vendors.length} vendors (all password: password123):`);
  vendorCreds.forEach((v) => console.log(`  ${v.name.padEnd(24)} ${v.email.padEnd(32)} (${v.items} items)`));

  console.log('\nSeed complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
