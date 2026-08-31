import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useGetVendorByIdQuery } from '../api/vendorApi';
import { useGetMenuByVendorQuery } from '../api/productApi';
import { useGetVendorPlansQuery, useInitiateSubscriptionPaymentMutation, useConfirmSubscriptionPaymentMutation } from '../api/subscriptionApi';
import { addItem, removeItem, updateQuantity } from '../store/slices/cartSlice';
import { getVendorVisual } from '../utils/vendorVisuals';
import { collectPayment } from '../utils/razorpay';
import { resolveImageUrl } from '../constants';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function SubscriptionPlanCard({ plan }) {
  const { user } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const [initiate, { isLoading: initiating }] = useInitiateSubscriptionPaymentMutation();
  const [confirm, { isLoading: confirming }] = useConfirmSubscriptionPaymentMutation();
  const [error, setError] = useState('');
  const isLoading = initiating || confirming;

  const handleSubscribe = async () => {
    setError('');
    if (!user) return navigate('/login');
    try {
      const paymentOrder = await initiate({ planId: plan._id, weeks: 1 }).unwrap();
      const { paymentId, signature } = await collectPayment(paymentOrder, {
        description: `${plan.name} · 1 week`,
        prefillEmail: user?.email,
      });
      await confirm({
        planId: plan._id,
        weeks: 1,
        fulfillmentMethod: plan.fulfillmentMethod,
        gatewayOrderId: paymentOrder.gatewayOrderId,
        paymentId,
        signature,
      }).unwrap();
      navigate('/my-subscriptions');
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Could not subscribe');
    }
  };

  return (
    <div className="card p-4 flex justify-between items-start gap-3">
      <div>
        <p className="font-semibold text-slate-800">{plan.name}</p>
        <p className="text-sm text-slate-500">{plan.items.map((i) => `${i.itemName} ×${i.quantity}`).join(', ')}</p>
        <p className="text-xs text-slate-400 mt-1">
          {plan.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')} · {plan.fulfillmentMethod === 'Delivery' ? '🛵' : '🥡'} {plan.fulfillmentMethod}
        </p>
        {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-slate-800 mb-1">₹{plan.pricePerWeek}<span className="text-xs font-normal text-slate-400">/wk</span></p>
        <button onClick={handleSubscribe} disabled={isLoading} className="btn-primary text-xs px-3 py-1.5">
          {isLoading ? 'Processing...' : 'Subscribe'}
        </button>
      </div>
    </div>
  );
}

// Compact +/- control shown in place of the "Add now"/"Pre-book" button once
// that line is already in the cart — gives immediate, visible feedback that
// the tap registered, instead of the button just silently staying clickable.
function QuantityStepper({ quantity, onIncrement, onDecrement, label, atMax }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-3 bg-orange-50 rounded-full pl-1 pr-1 py-1" aria-label={label}>
        <button
          onClick={onDecrement}
          aria-label={`Remove one ${label}`}
          className="w-8 h-8 rounded-full bg-white shadow-sm text-orange-600 text-lg font-bold flex items-center justify-center hover:bg-orange-100 active:scale-95 transition-transform"
        >
          −
        </button>
        <span className="min-w-[1.25rem] text-center text-sm font-bold text-slate-800 tabular-nums">{quantity}</span>
        <button
          onClick={onIncrement}
          disabled={atMax}
          aria-label={`Add one more ${label}`}
          className="w-8 h-8 rounded-full bg-white shadow-sm text-orange-600 text-lg font-bold flex items-center justify-center hover:bg-orange-100 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          +
        </button>
      </div>
      {atMax && <span className="text-[10px] text-amber-600 font-medium pr-1">Max available</span>}
    </div>
  );
}

function MenuItemCard({ item, vendorId, vendorName }) {
  const dispatch = useDispatch();
  const cart = useSelector((s) => s.cart);

  // Cart is single-vendor, so a line here only counts if the cart hasn't
  // already been claimed by a different vendor (see cartSlice.addItem).
  const cartLine = (orderType) =>
    cart.vendorId && cart.vendorId !== vendorId ? null : cart.items.find((i) => i.productId === item._id && i.orderType === orderType);

  const handleAdd = (orderType) => {
    dispatch(
      addItem({
        productId: item._id,
        itemName: item.itemName,
        price: item.price,
        quantity: 1,
        orderType,
        vendorId,
        vendorName,
        collectionStartTime: item.collectionStartTime || null,
        collectionEndTime: item.collectionEndTime || null,
        maxQuantity: orderType === 'Direct' ? item.currentQuantity : item.nextBatchQuantity,
      })
    );
  };

  const handleDecrement = (line) => {
    if (line.quantity <= 1) dispatch(removeItem(item._id));
    else dispatch(updateQuantity({ productId: item._id, quantity: line.quantity - 1 }));
  };

  const directLine = cartLine('Direct');
  const prebookLine = cartLine('Prebook');

  return (
    <div className="card card-hover p-4 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
      <div className="flex gap-3 min-w-0">
        {item.imageUrl && (
          <img src={resolveImageUrl(item.imageUrl)} alt={item.itemName} className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0" />
        )}
        <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-3.5 h-3.5 border-2 rounded-sm ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
            <span className={`block w-1.5 h-1.5 m-auto mt-[3px] rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
          </span>
          <h3 className="font-semibold text-slate-800">{item.itemName}</h3>
        </div>
        {item.description && <p className="text-sm text-slate-500 mt-1">{item.description}</p>}
        <p className="text-base font-bold text-slate-700 mt-1.5">₹{item.price}</p>
        <p className="text-xs text-slate-400 mt-1">
          {item.currentQuantity > 0 ? (
            <span className="text-emerald-600 font-medium">{item.currentQuantity} left now</span>
          ) : (
            <span className="text-red-500 font-medium">Sold out for now</span>
          )}
          {item.availableForPrebook && item.isPrebookOpen && (
            <>
              {' · '}
              {item.nextBatchQuantity > 0 ? (
                <span className="text-blue-600 font-medium">{item.nextBatchQuantity} left to pre-book</span>
              ) : (
                <span className="text-red-500 font-medium">Pre-book batch full</span>
              )}
            </>
          )}
        </p>
        {item.availableForPrebook && (item.collectionStartTime || item.collectionEndTime) && (
          <p className="text-xs text-slate-400 mt-0.5">
            🥡 Ready for collection: {item.collectionStartTime ? new Date(item.collectionStartTime).toLocaleString() : 'now'}
            {' → '}
            {item.collectionEndTime ? new Date(item.collectionEndTime).toLocaleString() : 'further notice'}
          </p>
        )}
        </div>
      </div>

      <div className="flex flex-row sm:flex-col gap-2 shrink-0">
        {directLine ? (
          <QuantityStepper
            label={`${item.itemName} (direct)`}
            quantity={directLine.quantity}
            atMax={directLine.quantity >= item.currentQuantity}
            onIncrement={() => handleAdd('Direct')}
            onDecrement={() => handleDecrement(directLine)}
          />
        ) : (
          <button
            disabled={!item.canOrderDirect}
            onClick={() => handleAdd('Direct')}
            className="btn-primary text-sm px-3.5 py-1.5 disabled:!bg-none disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            Add now
          </button>
        )}
        {item.availableForPrebook && (
          prebookLine ? (
            <QuantityStepper
              label={`${item.itemName} (pre-book)`}
              quantity={prebookLine.quantity}
              atMax={prebookLine.quantity >= item.nextBatchQuantity}
              onIncrement={() => handleAdd('Prebook')}
              onDecrement={() => handleDecrement(prebookLine)}
            />
          ) : (
            <button
              disabled={!item.canPrebook}
              onClick={() => handleAdd('Prebook')}
              className="btn-outline text-sm px-3.5 py-1.5 disabled:border-slate-200 disabled:text-slate-400 disabled:bg-white"
            >
              Pre-book
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function VendorMenu() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: vendor, isLoading: vendorLoading } = useGetVendorByIdQuery(id);
  const { data: menu, isLoading: menuLoading } = useGetMenuByVendorQuery(id);
  const { data: plans } = useGetVendorPlansQuery(id);
  const cartVendorId = useSelector((s) => s.cart.vendorId);

  if (vendorLoading || menuLoading) return <p className="p-4 text-slate-500">Loading...</p>;
  if (!vendor) return <p className="p-4 text-red-600">Vendor not found</p>;

  const { emoji, gradient } = getVendorVisual(vendor._id);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <button
        onClick={() => (window.history.length > 2 ? navigate(-1) : navigate('/'))}
        className="text-sm text-slate-500 hover:text-orange-600 mb-3 inline-flex items-center gap-1"
      >
        ← Back
      </button>

      <div className="card p-5 mb-6 flex gap-4">
        <div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} shrink-0 flex items-center justify-center text-3xl shadow-inner`}
        >
          {emoji}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{vendor.businessName}</h1>
            {vendor.isNew && <span className="badge-blue">✨ New</span>}
            {vendor.subscriptionPlan === 'pro' && <span className="badge-amber">⭐ Pro</span>}
          </div>
          <p className="text-sm text-slate-500 mt-1">🛡️ FSSAI License: {vendor.fssaiLicense}</p>
          <p className="text-sm text-slate-500">
            <span className="text-amber-500">★</span> {vendor.averageRating.toFixed(1)} ({vendor.ratingCount} ratings) &middot; {vendor.totalOrdersCompleted} orders completed
          </p>
          {vendor.description && <p className="text-sm text-slate-600 mt-2">{vendor.description}</p>}

          {vendor.kitchenLocation?.coordinates && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${vendor.kitchenLocation.coordinates[1]},${vendor.kitchenLocation.coordinates[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 mt-2 font-medium"
              title="Open directions in Google Maps"
            >
              📍 {vendor.kitchenLocation.address || 'Get directions'}
            </a>
          )}
        </div>
      </div>

      {cartVendorId && cartVendorId !== id && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          ⚠️ Adding items here will replace your current cart from another vendor.
        </p>
      )}
      <p className="text-xs text-slate-400 mb-4">
        Note: an order is either "Add now" (direct) or "Pre-book" items — mixing the two starts a new cart.
      </p>

      {plans && plans.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-slate-700 mb-2">📅 Subscription plans</h2>
          <div className="flex flex-col gap-3">
            {plans.map((plan) => <SubscriptionPlanCard key={plan._id} plan={plan} />)}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {menu?.map((item) => (
          <MenuItemCard key={item._id} item={item} vendorId={vendor._id} vendorName={vendor.businessName} />
        ))}
      </div>

      {menu && menu.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🍽️</p>
          <p className="text-slate-500">This vendor hasn't listed any items yet.</p>
        </div>
      )}
    </div>
  );
}
