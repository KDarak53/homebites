// Wraps Razorpay Checkout so callers don't need to know whether the backend
// is running against a real gateway or the mock fallback (config/payments.js
// on the backend) — either way this resolves with { paymentId, signature }
// on success, or rejects if the customer cancels/it fails.

let scriptPromise = null;

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load payment gateway script'));
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

// `paymentOrder` is whatever POST /api/orders/initiate (or /subscriptions/initiate,
// /vendors/me/upgrade/initiate) returned: { mock, gatewayOrderId, amount, currency, keyId }
export async function collectPayment(paymentOrder, { name, description, prefillEmail, prefillContact } = {}) {
  if (paymentOrder.mock) {
    // Dev/demo mode — no real gateway configured on the backend. "Pay"
    // instantly so the rest of the flow stays fully testable.
    return { paymentId: `mock_pay_${Date.now()}`, signature: 'mock' };
  }

  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: paymentOrder.keyId,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: name || 'HomeBites',
      description: description || 'Order payment',
      order_id: paymentOrder.gatewayOrderId,
      prefill: { email: prefillEmail, contact: prefillContact },
      theme: { color: '#b8641a' },
      handler: (response) => {
        resolve({ paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
      },
      modal: {
        ondismiss: () => reject(new Error('Payment was cancelled')),
      },
    });
    rzp.on('payment.failed', () => reject(new Error('Payment failed')));
    rzp.open();
  });
}
