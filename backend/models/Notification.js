const mongoose = require('mongoose');

// A durable, per-user notification inbox — Socket.IO alone only reaches a
// client that's connected right now, so anything that happens while the
// app/tab is closed (an order status change, a subscription running low on
// credits) would otherwise just vanish. This is checked next time the user
// opens the app, regardless of whether they were online when it happened.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['order_status', 'new_order', 'subscription', 'vendor_approval', 'vendor_suspension', 'general'],
      default: 'general',
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
