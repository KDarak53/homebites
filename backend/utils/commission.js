const PlatformSettings = require('../models/PlatformSettings');

// Shared between order checkout and the subscription scheduler so the two
// paths can never drift into charging a different rate for the same vendor.
async function computeCommission(vendor, itemsTotal) {
  const settings = await PlatformSettings.getSingleton();
  const isPro = vendor.subscriptionPlan === 'pro' && vendor.subscriptionExpiresAt && vendor.subscriptionExpiresAt > new Date();
  const platformCommissionRate = isPro ? settings.platformCommissionRatePro : settings.platformCommissionRateFree;
  const platformCommissionAmount = Math.round(itemsTotal * platformCommissionRate);
  const vendorPayoutAmount = itemsTotal - platformCommissionAmount;
  return { platformCommissionRate, platformCommissionAmount, vendorPayoutAmount };
}

module.exports = { computeCommission };
