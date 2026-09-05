import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useGetVendorDetailsQuery,
  useGetItemHistoryQuery,
  useApproveVendorMutation,
  useRejectVendorMutation,
  useSuspendVendorMutation,
  useUnsuspendVendorMutation,
} from '../api/adminApi';
import { resolveImageUrl } from '../constants';
import { vendorStatus } from '../utils/adminVendorStatus';

const STATUS_BADGE = {
  Completed: 'badge-green',
  Cancelled: 'badge-red',
  Rejected: 'badge-red',
};

// The "click an item" drill-down: real order-level history for that one
// menu item, not just a running total — who bought it, when, how much, and
// whether it was a Direct or Pre-book sale.
function ItemHistoryPanel({ vendorId, productId }) {
  const { data, isLoading, error } = useGetItemHistoryQuery({ vendorId, productId });

  if (isLoading) return <p className="text-sm text-slate-400 py-3">Loading order history...</p>;
  if (error) return <p className="text-sm text-red-500 py-3">Couldn't load history.</p>;
  if (!data) return null;

  const { summary, lines } = data;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="grid grid-cols-3 xs:grid-cols-6 gap-2 mb-3">
        {[
          ['Total sold', summary.totalQuantity],
          ['Revenue', `₹${summary.totalRevenue}`],
          ['Orders', summary.orderCount],
          ['Avg qty/order', summary.avgQuantityPerOrder],
          ['Direct', summary.directQuantity],
          ['Pre-book', summary.prebookQuantity],
        ].map(([label, value]) => (
          <div key={label} className="bg-slate-50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-sm font-bold text-slate-800">{value}</p>
            <p className="text-[10px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-slate-400">No paid orders for this item yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-1.5 pr-3 font-medium">Date</th>
                <th className="pb-1.5 pr-3 font-medium">Customer</th>
                <th className="pb-1.5 pr-3 font-medium">Qty</th>
                <th className="pb-1.5 pr-3 font-medium">Revenue</th>
                <th className="pb-1.5 pr-3 font-medium">Type</th>
                <th className="pb-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.orderId + line.createdAt} className="border-t border-slate-50">
                  <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">{new Date(line.createdAt).toLocaleDateString()}</td>
                  <td className="py-1.5 pr-3 text-slate-700">{line.customerName}</td>
                  <td className="py-1.5 pr-3 text-slate-700 tabular-nums">{line.quantity}</td>
                  <td className="py-1.5 pr-3 text-slate-700 tabular-nums">₹{line.lineRevenue}</td>
                  <td className="py-1.5 pr-3 text-slate-500">
                    {line.orderType === 'Direct' ? '🛒' : '📅'} {line.orderType}
                  </td>
                  <td className="py-1.5">
                    <span className={STATUS_BADGE[line.status] || 'badge-slate'}>{line.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminVendorDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useGetVendorDetailsQuery(id);
  const [approveVendor, { isLoading: approving }] = useApproveVendorMutation();
  const [rejectVendor, { isLoading: rejecting }] = useRejectVendorMutation();
  const [suspendVendor, { isLoading: suspending }] = useSuspendVendorMutation();
  const [unsuspendVendor, { isLoading: resuming }] = useUnsuspendVendorMutation();
  const [expandedItem, setExpandedItem] = useState(null);

  if (isLoading) return <p className="p-4 text-slate-500">Loading vendor...</p>;
  if (error || !data) return <p className="p-4 text-red-600">Couldn't load this vendor.</p>;

  const { vendor, menu, itemStats, earnings } = data;
  const revenueByProduct = Object.fromEntries(itemStats.map((s) => [String(s.productId), s]));
  const status = vendorStatus(vendor);
  const busy = approving || rejecting || suspending || resuming;

  const handlePause = () => {
    const reason = window.prompt(`Reason for pausing ${vendor.businessName}? (shown to the vendor, optional)`);
    if (reason === null) return; // cancelled
    suspendVendor({ id: vendor._id, reason });
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <Link to="/admin" className="text-sm text-slate-500 hover:text-orange-600 mb-3 inline-flex items-center gap-1">
        ← Back to admin console
      </Link>

      <div className="card p-5 mb-6">
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800">{vendor.businessName}</h1>
              <span className={status.tone}>{status.label}</span>
              {vendor.subscriptionPlan === 'pro' && <span className="badge-amber">⭐ Pro</span>}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {vendor.user?.name} &middot; {vendor.user?.email} &middot; {vendor.user?.phone}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">🛡️ FSSAI: {vendor.fssaiLicense}</p>
            {vendor.kitchenLocation?.address && <p className="text-sm text-slate-400 mt-0.5">📍 {vendor.kitchenLocation.address}</p>}
            {vendor.description && <p className="text-sm text-slate-600 mt-2">{vendor.description}</p>}
            <p className="text-sm text-slate-400 mt-2">
              ★ {vendor.averageRating?.toFixed?.(1) ?? 0} ({vendor.ratingCount || 0}) &middot; {vendor.totalOrdersCompleted || 0} orders completed
              &middot; {vendor.deliveryEnabled ? `🛵 delivery up to ${vendor.maxDeliveryRadiusKm}km (₹${vendor.deliveryFee})` : '🥡 takeaway only'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Joined {new Date(vendor.createdAt).toLocaleDateString()}</p>
            {vendor.isSuspendedByAdmin && vendor.suspensionReason && (
              <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-2 py-1 inline-block">Suspension reason: {vendor.suspensionReason}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {vendor.isSuspendedByAdmin ? (
              <button disabled={busy} onClick={() => unsuspendVendor(vendor._id)} className="btn-primary text-sm px-3.5 py-1.5">
                Resume
              </button>
            ) : vendor.isApproved ? (
              <button disabled={busy} onClick={handlePause} className="text-sm px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold">
                Pause
              </button>
            ) : vendor.rejectedAt ? (
              <button disabled={busy} onClick={() => approveVendor(vendor._id)} className="btn-primary text-sm px-3.5 py-1.5">
                Re-approve
              </button>
            ) : (
              <>
                <button disabled={busy} onClick={() => approveVendor(vendor._id)} className="btn-primary text-sm px-3.5 py-1.5">
                  Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => rejectVendor({ id: vendor._id })}
                  className="text-sm px-3.5 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 font-semibold"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-slate-800 mb-3">💰 Earnings</h2>
      <div className="grid grid-cols-2 xs:grid-cols-3 gap-3 mb-6">
        {[
          ['Revenue (GMV)', `₹${earnings.gmv}`, 'text-slate-800'],
          ['Platform commission', `₹${earnings.commissionCollected}`, 'text-orange-600'],
          ['Vendor payout', `₹${earnings.netPayout}`, 'text-emerald-600'],
          ['Paid orders', earnings.totalOrders, 'text-slate-800'],
          ['Completed', earnings.completedOrders, 'text-slate-800'],
          ['Avg order value', `₹${earnings.avgOrderValue}`, 'text-slate-800'],
        ].map(([label, value, tone]) => (
          <div key={label} className="card px-4 py-3 text-center">
            <p className={`text-lg font-bold ${tone}`}>{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <h2 className="font-semibold text-slate-800 mb-1">📋 Menu ({menu.length})</h2>
      <p className="text-xs text-slate-400 mb-3">Click an item to see its full order history.</p>
      <div className="flex flex-col gap-2">
        {menu.length === 0 && <p className="text-slate-500 text-sm">No menu items listed.</p>}
        {menu.map((item) => {
          const stat = revenueByProduct[String(item._id)];
          const isExpanded = expandedItem === item._id;
          return (
            <div key={item._id} className="card p-3.5">
              <button onClick={() => setExpandedItem(isExpanded ? null : item._id)} className="w-full flex items-center gap-3 text-left">
                {item.imageUrl ? (
                  <img src={resolveImageUrl(item.imageUrl)} alt="" className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-slate-100 shrink-0" />
                )}
                <span className={`inline-block w-3 h-3 rounded-sm border-2 shrink-0 ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                  <span className={`block w-1.5 h-1.5 m-auto mt-[1px] rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {item.itemName} {!item.isActive && <span className="text-slate-400 font-normal">(inactive)</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    ₹{item.price} &middot; {item.currentQuantity}/{item.maxQuantityPerBatch} in stock
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-700">{stat?.quantitySold || 0} sold</p>
                  <p className="text-xs text-slate-400">₹{stat?.revenue || 0}</p>
                </div>
                <span className="text-slate-400 shrink-0">{isExpanded ? '▲' : '▼'}</span>
              </button>
              {isExpanded && <ItemHistoryPanel vendorId={vendor._id} productId={item._id} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
