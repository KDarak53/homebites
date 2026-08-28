const crypto = require('crypto');
const Razorpay = require('razorpay');

// Real Razorpay integration when keys are configured; falls back to a
// clearly-labeled mock mode for local development/demo so the checkout flow
// stays fully testable without a merchant account. Swap in real
// RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (test-mode keys work fine, no KYC
// required) to exercise the real gateway.
const isConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const razorpay = isConfigured
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

if (!isConfigured) {
  console.warn(
    '[payments] RAZORPAY_KEY_ID/SECRET not set — running in MOCK payment mode. ' +
      'Orders will auto-complete "payment" without a real gateway. Add real test-mode keys to .env to use actual Razorpay checkout.'
  );
}

// Creates a payable unit (a Razorpay order, or a mock equivalent) for the
// given amount in rupees. Returns what the frontend needs to open checkout.
async function createPaymentOrder({ amountRupees, receipt }) {
  if (!isConfigured) {
    return {
      mock: true,
      gatewayOrderId: `mock_${crypto.randomBytes(8).toString('hex')}`,
      amount: Math.round(amountRupees * 100),
      currency: 'INR',
      keyId: null,
    };
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amountRupees * 100), // paise
    currency: 'INR',
    receipt,
  });
  return { mock: false, gatewayOrderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID };
}

// Verifies the signature Razorpay's checkout returns after a successful
// payment. In mock mode, any payment reference naming the matching mock
// order id is accepted (there is no real signature to check).
function verifyPaymentSignature({ gatewayOrderId, paymentId, signature }) {
  if (!isConfigured || String(gatewayOrderId).startsWith('mock_')) {
    return Boolean(gatewayOrderId && paymentId);
  }
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${gatewayOrderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

module.exports = { isConfigured, createPaymentOrder, verifyPaymentSignature };
