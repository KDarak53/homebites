const mongoose = require('mongoose');

// Singleton document (there is only ever one). Lets the platform sequence
// its own rollout — e.g. force Takeaway/Pre-book only while delivery
// logistics partnerships aren't proven yet — rather than leaving fulfillment
// entirely up to each individual vendor's own toggle.
const platformSettingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'singleton', unique: true },
    deliveryRolloutEnabled: { type: Boolean, default: true },
    platformCommissionRateFree: { type: Number, default: 0.12 }, // 12% — free-tier vendors
    platformCommissionRatePro: { type: Number, default: 0.08 }, // 8% — paid "pro" tier vendors
    proSubscriptionPricePerMonth: { type: Number, default: 349 },
  },
  { timestamps: true }
);

platformSettingsSchema.statics.getSingleton = async function getSingleton() {
  let settings = await this.findOne({ singleton: 'singleton' });
  if (!settings) settings = await this.create({ singleton: 'singleton' });
  return settings;
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
