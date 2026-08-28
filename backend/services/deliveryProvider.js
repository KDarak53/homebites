// Abstraction seam for last-mile delivery. The recommendation this
// implements is "rent logistics, don't own a fleet" — instead of the vendor
// (or platform) directly managing a courier, order fulfillment asks
// whichever provider is configured to handle the pickup. Today only a
// `manual` provider exists (the vendor manages delivery themselves, exactly
// like before); swapping in a real Porter/Dunzo/ONDC-logistics adapter later
// means implementing this same two-method interface and pointing
// DELIVERY_PROVIDER at it — no caller-side changes needed.

const manualProvider = {
  name: 'manual',
  // Called when an order moves to OutForDelivery. Returns a tracking
  // reference to store on the order; the manual provider has none, so it
  // returns null and the vendor continues to manage delivery themselves.
  async requestPickup() {
    return { providerRef: '', estimatedCostRupees: 0 };
  },
  async getStatus() {
    return { status: 'unknown' };
  },
};

const PROVIDERS = { manual: manualProvider };

function getActiveProvider() {
  const name = process.env.DELIVERY_PROVIDER || 'manual';
  return PROVIDERS[name] || manualProvider;
}

// A rough placeholder for what a courier actually costs the platform/vendor,
// used to separate "what the customer paid for delivery" from "what
// delivery actually cost" until a real provider reports the true figure.
// Gig-delivery minimum payouts in most Indian metros run roughly ₹30–40/order.
function estimateDeliveryCost(customerDeliveryFee) {
  return Math.max(30, customerDeliveryFee);
}

module.exports = { getActiveProvider, estimateDeliveryCost };
