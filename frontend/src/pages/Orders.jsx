import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useGetMyOrdersQuery, useRateOrderMutation } from '../api/orderApi';
import { connectSocket } from '../api/socket';
import { apiSlice } from '../api/apiSlice';
import { addItem } from '../store/slices/cartSlice';

const STATUS_STEPS = ['Pending', 'Accepted', 'Preparing', 'Ready', 'OutForDelivery', 'Completed'];
const TERMINAL_STATUSES = ['Completed', 'Cancelled', 'Rejected'];

function PickupQR({ order }) {
  const [open, setOpen] = useState(order.status === 'Ready' || order.status === 'OutForDelivery');

  if (TERMINAL_STATUSES.includes(order.status)) return null;

  return (
    <div className="mt-2 pt-2 border-t border-slate-100">
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-orange-600 font-semibold hover:text-orange-700">
        {open ? '▲ Hide pickup QR' : '▼ Show pickup QR'}
      </button>
      {open && (
        <div className="flex flex-col items-center gap-1 mt-2 p-4 bg-orange-50/60 rounded-xl border border-orange-100">
          <div className="bg-white p-2 rounded-lg shadow-sm">
            <QRCodeSVG value={order.pickupCode} size={120} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Code: <span className="font-mono font-bold tracking-wider text-slate-700">{order.pickupCode}</span>
          </p>
          <p className="text-xs text-slate-400 text-center max-w-[220px]">
            Show this to the vendor at pickup — they'll scan it (or type the code) to confirm.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusTracker({ status }) {
  if (status === 'Cancelled' || status === 'Rejected') {
    return <span className="badge-red">✕ {status}</span>;
  }
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {STATUS_STEPS.map((s, idx) => (
        <span
          key={s}
          className={
            idx < currentIdx
              ? 'px-2 py-0.5 rounded-full bg-orange-100 text-orange-700'
              : idx === currentIdx
                ? 'px-2 py-0.5 rounded-full bg-orange-600 text-white font-semibold shadow-sm'
                : 'px-2 py-0.5 rounded-full bg-slate-100 text-slate-400'
          }
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function RateButton({ order }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [rateOrder, { isLoading }] = useRateOrderMutation();

  if (order.rating) return <p className="text-xs text-amber-600 font-medium">You rated this {'★'.repeat(order.rating)}</p>;
  if (order.status !== 'Completed') return null;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-orange-600 font-semibold hover:text-orange-700">
        ⭐ Rate vendor
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="input py-1 px-1.5 text-xs">
        {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} ★</option>)}
      </select>
      <input
        placeholder="Comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="input py-1 px-2 text-xs flex-1"
      />
      <button
        disabled={isLoading}
        onClick={() => rateOrder({ id: order._id, rating, comment })}
        className="btn-primary text-xs px-2.5 py-1"
      >
        Submit
      </button>
    </div>
  );
}

export default function Orders() {
  const { data: orders, isLoading } = useGetMyOrdersQuery();
  const { token } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Reorder as a fresh Direct order — the original's Prebook cutoff (if any)
  // is stale, and stock/availability is re-validated at checkout anyway.
  const handleReorder = (order) => {
    order.items.forEach((item) => {
      dispatch(
        addItem({
          productId: item.product,
          itemName: item.itemName,
          price: item.unitPrice,
          quantity: item.quantity,
          orderType: 'Direct',
          vendorId: order.vendor._id,
          vendorName: order.vendor.businessName,
        })
      );
    });
    navigate('/cart');
  };

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    const handler = () => dispatch(apiSlice.util.invalidateTags(['Order']));
    socket.on('order:status', handler);
    // Only detach this page's own listener — the socket itself is shared
    // (NotificationBell in the navbar stays connected across navigation) and
    // is torn down on logout instead, see Navbar.jsx.
    return () => socket.off('order:status', handler);
  }, [token, dispatch]);

  if (isLoading) return <p className="p-4 text-slate-500">Loading orders...</p>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">📦 Your orders</h1>
      <div className="flex flex-col gap-3">
        {orders?.map((order) => (
          <div key={order._id} className="card p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-slate-800">{order.vendor?.businessName}</p>
                <p className="text-xs text-slate-400">
                  {order.orderType} &middot; {order.fulfillmentMethod} &middot; <span className="font-semibold text-slate-500">₹{order.totalAmount}</span>
                </p>
              </div>
              <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <ul className="text-sm text-slate-600 mb-3">
              {order.items.map((i) => (
                <li key={i.product}>{i.itemName} × {i.quantity}</li>
              ))}
            </ul>
            <StatusTracker status={order.status} />
            <PickupQR order={order} />
            <div className="mt-3 flex items-center gap-4">
              <button onClick={() => handleReorder(order)} className="text-xs text-slate-600 font-semibold hover:text-orange-600">
                ↻ Reorder
              </button>
              <RateButton order={order} />
            </div>
          </div>
        ))}
      </div>
      {orders && orders.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🧾</p>
          <p className="text-slate-500 mb-4">No orders yet.</p>
          <Link to="/" className="btn-primary px-5 py-2 inline-flex">Browse kitchens</Link>
        </div>
      )}
    </div>
  );
}
