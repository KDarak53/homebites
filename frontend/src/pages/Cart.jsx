import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useGetVendorByIdQuery } from '../api/vendorApi';
import { useInitiateOrderPaymentMutation, useConfirmOrderPaymentMutation } from '../api/orderApi';
import { removeItem, updateQuantity, clearCart } from '../store/slices/cartSlice';
import useGeolocation from '../hooks/useGeolocation';
import { DEFAULT_LOCATION } from '../constants';
import { collectPayment } from '../utils/razorpay';

export default function Cart() {
  const cart = useSelector((s) => s.cart);
  const { user } = useSelector((s) => s.auth);
  const { coords } = useGeolocation();
  const [deliveryLocation, setDeliveryLocation] = useState(DEFAULT_LOCATION);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (coords) setDeliveryLocation(coords);
  }, [coords]);

  const { data: vendor } = useGetVendorByIdQuery(cart.vendorId, { skip: !cart.vendorId });
  const [initiatePayment, { isLoading: isInitiating }] = useInitiateOrderPaymentMutation();
  const [confirmPayment, { isLoading: isConfirming }] = useConfirmOrderPaymentMutation();
  const [checkoutError, setCheckoutError] = useState('');
  const isLoading = isInitiating || isConfirming;

  const [fulfillmentMethod, setFulfillmentMethod] = useState('Takeaway');
  const [address, setAddress] = useState('');

  const orderType = cart.items[0]?.orderType || 'Direct';
  const itemsTotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = fulfillmentMethod === 'Delivery' ? vendor?.deliveryFee || 0 : 0;
  const total = itemsTotal + deliveryFee;

  // Narrowest collection window across every pre-booked item in the cart —
  // items without one set don't constrain it. If items disagree so badly
  // the window inverts (from > until), collectionWindow.invalid flags that
  // so we can surface it instead of quietly enforcing something impossible.
  const collectionWindow = (() => {
    if (orderType !== 'Prebook') return null;
    let from = null;
    let until = null;
    for (const item of cart.items) {
      if (item.collectionStartTime) {
        const t = new Date(item.collectionStartTime);
        if (!from || t > from) from = t;
      }
      if (item.collectionEndTime) {
        const t = new Date(item.collectionEndTime);
        if (!until || t < until) until = t;
      }
    }
    if (!from && !until) return null;
    return { from, until, invalid: from && until && from > until };
  })();

  // Pickup is the vendor's collection window itself, not a time the customer
  // dials in — there's nothing to schedule, so the value sent to the backend
  // (which still records a single timestamp and validates it falls in-window)
  // is just the start of that window. No window set at all just means "the
  // vendor will sort out timing after accepting" — fall back to now.
  const autoScheduledFor = orderType === 'Prebook' ? collectionWindow?.from || new Date() : null;

  if (cart.items.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-4 text-center py-20">
        <p className="text-5xl mb-3">🛒</p>
        <p className="text-slate-500 mb-4">Your cart is empty.</p>
        <Link to="/" className="btn-primary px-5 py-2 inline-flex">Browse kitchens</Link>
      </div>
    );
  }

  const handleCheckout = async () => {
    setCheckoutError('');

    if (orderType === 'Prebook' && collectionWindow?.invalid) {
      setCheckoutError('Items in this cart have conflicting collection times — check with the vendor before ordering.');
      return;
    }

    const orderPayload = {
      vendorId: cart.vendorId,
      items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      orderType,
      fulfillmentMethod,
      scheduledFor: orderType === 'Prebook' ? autoScheduledFor.toISOString() : undefined,
      deliveryCoordinates: fulfillmentMethod === 'Delivery' ? [deliveryLocation.longitude, deliveryLocation.latitude] : undefined,
      deliveryAddress: fulfillmentMethod === 'Delivery' ? address : undefined,
    };

    try {
      // Step 1: price the order and open a payable unit (real Razorpay order,
      // or a mock one in dev) — no inventory is touched yet.
      const paymentOrder = await initiatePayment(orderPayload).unwrap();

      // Step 2: collect payment (opens Razorpay Checkout, or resolves
      // instantly in mock mode) — only on success do we actually reserve
      // stock and create the order.
      const { paymentId, signature } = await collectPayment(paymentOrder, {
        description: `${cart.vendorName} · ${cart.items.length} item(s)`,
        prefillEmail: user?.email,
      });

      const order = await confirmPayment({
        ...orderPayload,
        gatewayOrderId: paymentOrder.gatewayOrderId,
        paymentId,
        signature,
      }).unwrap();

      dispatch(clearCart());
      navigate('/orders', { state: { justPlaced: order._id } });
    } catch (err) {
      setCheckoutError(err?.data?.message || err?.message || 'Could not place order');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">🛒 Your cart · {cart.vendorName}</h1>

      <div className="card divide-y divide-slate-100 mb-4">
        {cart.items.map((item) => (
          <div key={item.productId} className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 p-3.5">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{item.itemName}</p>
              <p className="text-xs text-slate-400">{item.orderType} &middot; ₹{item.price} each</p>
            </div>
            <div className="flex items-center justify-between xs:justify-end gap-3 shrink-0">
              <div className="flex items-center gap-3 bg-orange-50 rounded-full pl-1 pr-1 py-1">
                <button
                  onClick={() =>
                    item.quantity <= 1
                      ? dispatch(removeItem(item.productId))
                      : dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity - 1 }))
                  }
                  aria-label={`Remove one ${item.itemName}`}
                  className="w-8 h-8 rounded-full bg-white shadow-sm text-orange-600 text-lg font-bold flex items-center justify-center hover:bg-orange-100 active:scale-95 transition-transform"
                >
                  −
                </button>
                <span className="min-w-[1.25rem] text-center text-sm font-bold text-slate-800 tabular-nums">{item.quantity}</span>
                <button
                  onClick={() => dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }))}
                  disabled={item.maxQuantity != null && item.quantity >= item.maxQuantity}
                  aria-label={`Add one more ${item.itemName}`}
                  className="w-8 h-8 rounded-full bg-white shadow-sm text-orange-600 text-lg font-bold flex items-center justify-center hover:bg-orange-100 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  +
                </button>
              </div>
              <button onClick={() => dispatch(removeItem(item.productId))} className="text-red-500 text-xs hover:text-red-600 font-medium">
                Remove
              </button>
            </div>
            {item.maxQuantity != null && item.quantity >= item.maxQuantity && (
              <p className="text-[11px] text-amber-600 xs:text-right w-full">Max available quantity reached</p>
            )}
          </div>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <h2 className="font-semibold text-slate-800 mb-2">Fulfillment</h2>
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => setFulfillmentMethod('Takeaway')}
            className={fulfillmentMethod === 'Takeaway' ? 'btn-primary text-sm px-3.5 py-1.5' : 'btn-ghost text-sm px-3.5 py-1.5 border border-slate-300'}
          >
            🥡 Takeaway
          </button>
          <button
            disabled={!vendor?.deliveryEnabled}
            onClick={() => setFulfillmentMethod('Delivery')}
            className={
              fulfillmentMethod === 'Delivery'
                ? 'btn-primary text-sm px-3.5 py-1.5'
                : 'btn-ghost text-sm px-3.5 py-1.5 border border-slate-300 disabled:opacity-40'
            }
          >
            🛵 Delivery {vendor && !vendor.deliveryEnabled && '(unavailable)'}
          </button>
        </div>

        {fulfillmentMethod === 'Delivery' && (
          <div className="flex flex-col gap-2">
            <input
              placeholder="Delivery address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input w-full text-sm"
            />
            <div className="flex gap-2">
              <label className="flex flex-col gap-1 flex-1 min-w-0 text-xs text-slate-500">
                Latitude
                <input
                  type="number"
                  step="0.0001"
                  value={deliveryLocation.latitude}
                  onChange={(e) => setDeliveryLocation((l) => ({ ...l, latitude: Number(e.target.value) }))}
                  className="input py-1 text-sm w-full min-w-0"
                />
              </label>
              <label className="flex flex-col gap-1 flex-1 min-w-0 text-xs text-slate-500">
                Longitude
                <input
                  type="number"
                  step="0.0001"
                  value={deliveryLocation.longitude}
                  onChange={(e) => setDeliveryLocation((l) => ({ ...l, longitude: Number(e.target.value) }))}
                  className="input py-1 text-sm w-full min-w-0"
                />
              </label>
            </div>
            <p className="text-xs text-slate-400">
              Must be within the vendor's {vendor?.maxDeliveryRadiusKm}km delivery radius.
            </p>
          </div>
        )}

        {/* No time picker here — the customer can't schedule an arbitrary
            pickup moment, they just collect sometime within the window the
            vendor already set (shown on the menu page too). Sending an exact
            scheduledFor is still a backend requirement, so autoScheduledFor
            quietly uses the start of that window rather than asking for one. */}
        {orderType === 'Prebook' && (
          <div className="mt-3">
            {collectionWindow && !collectionWindow.invalid && (
              <p className="text-sm text-slate-600 bg-orange-50 rounded-lg px-3 py-2">
                🥡 Collect this {collectionWindow.from ? `from ${collectionWindow.from.toLocaleString()}` : ''}
                {collectionWindow.from && collectionWindow.until && ' '}
                {collectionWindow.until ? `until ${collectionWindow.until.toLocaleString()}` : ''} — no need to pick a time, just come by within that window.
              </p>
            )}
            {collectionWindow?.invalid && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                ⚠️ Items in this cart have conflicting collection times — check with the vendor before ordering.
              </p>
            )}
            {!collectionWindow && (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                🥡 The vendor hasn't set a specific collection window yet — they'll confirm pickup timing once they accept your order.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card p-4 mb-4 text-sm">
        <div className="flex justify-between text-slate-600"><span>Food total</span><span>₹{itemsTotal}</span></div>
        <div className="flex justify-between text-slate-600 mt-1"><span>Delivery fee</span><span>₹{deliveryFee}</span></div>
        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-slate-100 text-slate-800">
          <span>Total</span><span>₹{total}</span>
        </div>
      </div>

      {checkoutError && <p className="text-red-600 text-sm mb-3">{checkoutError}</p>}

      <button
        onClick={handleCheckout}
        disabled={isLoading || (orderType === 'Prebook' && collectionWindow?.invalid)}
        className="btn-primary w-full py-3 text-base"
      >
        {isLoading ? 'Placing order...' : `Place order · ₹${total}`}
      </button>
    </div>
  );
}
