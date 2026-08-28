const mongoose = require('mongoose');

// A customer's active subscription to a vendor's SubscriptionPlan. Prepaid,
// not recurring-billed: the customer buys a block of "credits" (one per
// scheduled delivery day) up front, and the daily cron in
// utils/subscriptionScheduler.js consumes one credit per plan day by
// creating a real Order against the vendor's batch — this is the same
// prepaid-recharge pattern most Indian tiffin services already use, and
// avoids needing a separate recurring-mandate integration with the payment
// gateway.
const customerSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true },

    creditsRemaining: { type: Number, required: true, min: 0, default: 0 },
    skippedDates: { type: [Date], default: [] }, // customer-chosen skip days, compared by y-m-d
    lastGeneratedDate: { type: Date, default: null }, // guards against double-generating the same day

    fulfillmentMethod: { type: String, enum: ['Delivery', 'Takeaway'], required: true },
    deliveryAddress: {
      coordinates: { type: [Number], default: undefined },
      address: { type: String, default: '' },
    },

    status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' },
  },
  { timestamps: true }
);

customerSubscriptionSchema.index({ status: 1, lastGeneratedDate: 1 });
customerSubscriptionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerSubscription', customerSubscriptionSchema);
