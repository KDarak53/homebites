require('dotenv').config();
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
const { isConfigured: emailConfigured, sendVerificationEmail } = require('./config/email');
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

// TEMPORARY diagnostic while wiring up SMTP — actually attempts a send and
// reports the real error inline (background sends elsewhere only log to
// server console, which isn't reachable from outside). Remove once email
// delivery is confirmed working end-to-end.
app.get('/api/health/test-email', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).json({ error: 'pass ?to=<email>' });
  try {
    const result = await sendVerificationEmail({ to, name: 'Test', verifyUrl: 'https://example.com/verify-email?token=test' });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, code: err.code });
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
