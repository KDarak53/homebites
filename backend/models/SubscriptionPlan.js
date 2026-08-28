const mongoose = require('mongoose');

// A vendor-defined recurring meal plan (the "tiffin subscription" pattern) —
// same vendor, a fixed set of items, delivered/collected on a fixed set of
// weekdays, sold as a prepaid weekly bundle rather than ordered one day at a
// time. See CustomerSubscription for a customer's active subscription to one
// of these.
const subscriptionPlanSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        itemName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
      },
    ],
    // Days of week this plan delivers/is collected on, 0 = Sunday ... 6 = Saturday.
    daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5], validate: (v) => v.every((d) => d >= 0 && d <= 6) },
    pricePerWeek: { type: Number, required: true, min: 0 },
    fulfillmentMethod: { type: String, enum: ['Delivery', 'Takeaway'], default: 'Takeaway' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subscriptionPlanSchema.index({ vendor: 1, isActive: 1 });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
