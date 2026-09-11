require('dotenv').config();
// Render (confirmed via /api/health/test-email) has no outbound IPv6 route,
// but Node's DNS resolver defaults to handing back IPv6 addresses first —
// any outbound connection to a dual-stack host (SMTP, third-party APIs...)
// would hit the same dead-end "ENETUNREACH <ipv6>" this caused for email.
// Preferring IPv4 process-wide avoids the whole class of failure.
require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const path = require('path');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { runDailySubscriptionCycle } = require('./utils/subscriptionScheduler');
const { isConfigured: emailConfigured } = require('./config/email');
const { isConfigured: paymentsConfigured } = require('./config/payments');

const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', credentials: true },
});

// Socket auth: client connects with { auth: { token } }. Vendors join a room
// keyed by their user id so order events can be pushed to their live dashboard;
// customers join a room keyed by their user id for order-status pushes.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.role = decoded.role;
    next();
  } catch (err) {
    next();
  }
});

io.on('connection', (socket) => {
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
    if (socket.role === 'vendor') {
      socket.on('vendor:register', (vendorProfileId) => {
        socket.join(`vendor:${vendorProfileId}`);
      });
    }
  }
});

app.set('io', io);

app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Booleans only — never the actual credentials — so mock-vs-real mode for a
// service is checkable without digging through host logs.
app.get('/api/health', (req, res) => res.json({ status: 'ok', emailConfigured, paymentsConfigured }));

// TEMPORARY diagnostic — remove once the gatewayOrderId unique-index issue
// is confirmed fixed. Read-only, no data, just index metadata.
app.get('/api/health/order-indexes', async (req, res) => {
  try {
    const Order = require('./models/Order');
    const indexes = await Order.collection.indexes();
    res.json({ indexes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEMPORARY diagnostic — attempts the index creation directly (bypassing
// Mongoose's silent background autoIndex path) so the real MongoDB error, if
// any, comes straight back in the response instead of only to a server log
// nobody here can read.
app.get('/api/health/order-index-create', async (req, res) => {
  try {
    const Order = require('./models/Order');
    const name = await Order.collection.createIndex(
      { gatewayOrderId: 1 },
      { unique: true, partialFilterExpression: { gatewayOrderId: { $type: 'string', $gt: '' } } }
    );
    res.json({ created: name });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code, codeName: err.codeName });
  }
});

// TEMPORARY, one-time cleanup — the index build above fails because a few
// gatewayOrderId values already have duplicate orders sitting in the
// collection from testing the bug this index exists to prevent. For each
// duplicated gatewayOrderId, keeps the oldest order and deletes the rest.
// Restocks whatever the deleted duplicates had reserved so their products'
// stock isn't left short. GET (not POST) purely so it's easy to trigger from
// a browser address bar for this one-off use — remove alongside the other
// diagnostics once done.
app.get('/api/health/dedupe-orders', async (req, res) => {
  try {
    const Order = require('./models/Order');
    const Product = require('./models/Product');
    const dupGroups = await Order.aggregate([
      { $match: { gatewayOrderId: { $type: 'string', $gt: '' } } },
      { $sort: { createdAt: 1 } },
      { $group: { _id: '$gatewayOrderId', ids: { $push: '$_id' }, items: { $push: '$items' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    const removed = [];
    for (const group of dupGroups) {
      const [, ...duplicateIds] = group.ids; // keep the first (oldest), drop the rest
      const duplicateItemSets = group.items.slice(1);
      for (const items of duplicateItemSets) {
        for (const item of items) {
          const field = item.fromBatch === 'next' ? 'nextBatchQuantity' : 'currentQuantity';
          await Product.updateOne({ _id: item.product }, { $inc: { [field]: item.quantity } });
        }
      }
      await Order.deleteMany({ _id: { $in: duplicateIds } });
      removed.push({ gatewayOrderId: group._id, deleted: duplicateIds.length });
    }
    res.json({ dupGroupsFound: dupGroups.length, removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => console.log(`HomeBites API running on port ${PORT}`));

    // Once a day at 06:00 server time: draw a credit from every subscription
    // scheduled for today and create the real order against the vendor's
    // batch. Exposed on `global` too so it can be triggered manually for
    // testing without waiting for the clock.
    cron.schedule('0 6 * * *', () => {
      runDailySubscriptionCycle(io).catch((err) => console.error('[subscription cycle] failed:', err));
    });
    global.runDailySubscriptionCycle = () => runDailySubscriptionCycle(io);
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

module.exports = { app, server, io };
