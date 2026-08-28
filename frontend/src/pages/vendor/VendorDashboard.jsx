import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetVendorDashboardQuery, useUpdateOrderStatusMutation } from '../../api/orderApi';
import { useGetMyVendorProfileQuery, useGetVendorAnalyticsQuery } from '../../api/vendorApi';
import { connectSocket } from '../../api/socket';
import { apiSlice } from '../../api/apiSlice';
import PickupScanner from '../../components/PickupScanner';

// The 'Ready' step branches by fulfillment method: a delivery order needs an
// "out for delivery" leg. A takeaway order at 'Ready' has no direct-complete
// button — completion is gated behind scanning/entering the customer's
// pickup code (see PickupScanner), not a self-reported click.
const NEXT_STATUS = {
  Pending: [{ label: 'Accept', to: 'Accepted' }, { label: 'Reject', to: 'Rejected' }],
  Accepted: [{ label: 'Start preparing', to: 'Preparing' }, { label: 'Cancel', to: 'Cancelled' }],
  Preparing: [{ label: 'Mark ready', to: 'Ready' }],
  Ready: {
    Delivery: [{ label: 'Out for delivery', to: 'OutForDelivery' }],
    Takeaway: [],
  },
  OutForDelivery: [{ label: 'Complete', to: 'Completed' }],
};

const STATUS_BADGE = {
  Pending: 'badge-amber',
  Accepted: 'badge-blue',
  Preparing: 'badge-amber',
  Ready: 'badge-green',
  OutForDelivery: 'badge-blue',
  Completed: 'badge-green',
  Cancelled: 'badge-red',
  Rejected: 'badge-red',
};

function OrderCard({ order }) {
  const [updateStatus, { isLoading }] = useUpdateOrderStatusMutation();
  const stepActions = NEXT_STATUS[order.status] || [];
  const actions = Array.isArray(stepActions) ? stepActions : stepActions[order.fulfillmentMethod] || [];
  const awaitingPickupScan = order.status === 'Ready' && order.fulfillmentMethod === 'Takeaway';

  return (
    <div className="card card-hover p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-slate-800">{order.user?.name}</p>
          <p className="text-xs text-slate-400">{order.user?.phone} &middot; {order.fulfillmentMethod === 'Delivery' ? '🛵' : '🥡'} {order.fulfillmentMethod}</p>
        </div>
        <span className={STATUS_BADGE[order.status] || 'badge-slate'}>{order.status}</span>
      </div>
      <ul className="text-sm text-slate-600 mb-2">
        {order.items.map((i) => <li key={i.product}>{i.itemName} × {i.quantity}</li>)}
      </ul>
      {order.scheduledFor && (
        <p className="text-xs text-amber-700 mb-2 bg-amber-50 rounded px-2 py-1 inline-block">📅 Scheduled: {new Date(order.scheduledFor).toLocaleString()}</p>
      )}
      <p className="text-base font-bold text-slate-700 mb-3">₹{order.totalAmount}</p>
      {awaitingPickupScan && (
        <p className="text-xs text-orange-600 mb-2 bg-orange-50 rounded px-2 py-1.5">📷 Waiting for pickup — scan the customer's QR above to complete.</p>
      )}
      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a.to}
            disabled={isLoading}
            onClick={() => updateStatus({ id: order._id, status: a.to })}
            className="btn-primary text-xs px-3.5 py-1.5"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function VendorDashboard() {
  const { data: profile } = useGetMyVendorProfileQuery();
  const { data: dashboard, isLoading } = useGetVendorDashboardQuery();
  const { data: analytics } = useGetVendorAnalyticsQuery('weekly');
  const { token } = useSelector((s) => s.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!token || !profile?._id) return;
    const socket = connectSocket(token);
    socket.emit('vendor:register', profile._id);
    const handler = () => dispatch(apiSlice.util.invalidateTags(['Order']));
    socket.on('order:new', handler);
    // Only detach this page's own listener — see Orders.jsx for why the
    // socket itself isn't disconnected here.
    return () => socket.off('order:new', handler);
  }, [token, profile?._id, dispatch]);

  if (isLoading) return <p className="p-4 text-slate-500">Loading dashboard...</p>;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">📊 Order dashboard</h1>
      <p className="text-slate-500 text-sm mb-4">
        {profile?.businessName} {profile?.subscriptionPlan === 'pro' && <span className="badge-amber ml-1">⭐ Pro</span>}
      </p>

      {profile && !profile.isApproved && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          ⏳ Your kitchen is awaiting admin approval — it won't appear in customer search or be able to take orders until approved.
        </p>
      )}

      {analytics && (
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="card px-5 py-3.5 flex-1 min-w-[150px] max-w-[200px]">
            <p className="text-xs text-slate-400">💰 Revenue (7d)</p>
            <p className="font-bold text-slate-800 text-lg">₹{analytics.revenue}</p>
            <p className="text-xs text-slate-500">{analytics.ordersCompleted} orders</p>
          </div>
          <div className="card px-5 py-3.5 flex-1 min-w-[150px] max-w-[200px]">
            <p className="text-xs text-slate-400">🏛️ Commission paid</p>
            <p className="font-bold text-orange-600 text-lg">₹{analytics.commissionPaid}</p>
          </div>
          <div className="card px-5 py-3.5 flex-1 min-w-[150px] max-w-[200px]">
            <p className="text-xs text-slate-400">💵 Net payout</p>
            <p className="font-bold text-emerald-600 text-lg">₹{analytics.netPayout}</p>
          </div>
          {analytics.popularItems.length > 0 && (
            <div className="card px-5 py-3.5 flex-1 min-w-[150px] max-w-[220px]">
              <p className="text-xs text-slate-400">🔥 Top item</p>
              <p className="font-bold text-slate-800 truncate">{analytics.popularItems[0].itemName}</p>
              <p className="text-xs text-slate-500">{analytics.popularItems[0].qty} sold</p>
            </div>
          )}
        </div>
      )}

      <PickupScanner />

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold text-slate-700 mb-2">⚡ Immediate fulfillment</h2>
          <div className="flex flex-col gap-3">
            {dashboard?.immediate.map((o) => <OrderCard key={o._id} order={o} />)}
            {dashboard?.immediate.length === 0 && <p className="text-sm text-slate-400">No live orders.</p>}
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-slate-700 mb-2">📅 Pre-booked / scheduled</h2>
          <div className="flex flex-col gap-3">
            {dashboard?.prebooked.map((o) => <OrderCard key={o._id} order={o} />)}
            {dashboard?.prebooked.length === 0 && <p className="text-sm text-slate-400">No pre-booked orders.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
