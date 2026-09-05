import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetAllVendorsQuery,
  useGetPendingVendorsQuery,
  useApproveVendorMutation,
  useRejectVendorMutation,
  useRequestVendorChangesMutation,
  useSuspendVendorMutation,
  useUnsuspendVendorMutation,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
  useGetAdminOverviewQuery,
} from '../api/adminApi';
import { vendorStatus } from '../utils/adminVendorStatus';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-orange-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function PendingVendorCard({ vendor }) {
  const [approveVendor, { isLoading: approving }] = useApproveVendorMutation();
  const [rejectVendor, { isLoading: rejecting }] = useRejectVendorMutation();
  const [requestChanges, { isLoading: requesting }] = useRequestVendorChangesMutation();
  const busy = approving || rejecting || requesting;

  const resubmitted = vendor.resubmittedAt && new Date(vendor.resubmittedAt) > new Date(vendor.changesRequestedAt);

  const handleRequestChanges = () => {
    const reason = window.prompt(`What does ${vendor.businessName} need to fix before approval? (shown to the vendor)`);
    if (!reason) return; // cancelled or left blank — nothing constructive to send
    requestChanges({ id: vendor._id, reason });
  };

  return (
    <div className="card p-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="font-semibold text-slate-800">{vendor.businessName}</p>
          <p className="text-xs text-slate-500">{vendor.user?.name} &middot; {vendor.user?.email} &middot; {vendor.user?.phone}</p>
          <p className="text-xs text-slate-500 mt-1">🛡️ FSSAI: {vendor.fssaiLicense}</p>
          {vendor.kitchenLocation?.address && <p className="text-xs text-slate-400">📍 {vendor.kitchenLocation.address}</p>}
          {vendor.changesRequestedReason && (
            <p className={`text-xs mt-2 rounded-lg px-2 py-1.5 ${resubmitted ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
              {resubmitted ? '🔄 Vendor resubmitted after changes.' : '✏️ Awaiting vendor changes.'} Asked: "{vendor.changesRequestedReason}"
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button disabled={busy} onClick={() => approveVendor(vendor._id)} className="btn-primary text-xs px-3 py-1.5">
            Approve
          </button>
          <button
            disabled={busy}
            onClick={handleRequestChanges}
            className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold"
          >
            Request changes
          </button>
          <button disabled={busy} onClick={() => rejectVendor({ id: vendor._id })} className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 font-semibold">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function AllVendorCard({ vendor }) {
  const [approveVendor, { isLoading: approving }] = useApproveVendorMutation();
  const [suspendVendor, { isLoading: suspending }] = useSuspendVendorMutation();
  const [unsuspendVendor, { isLoading: resuming }] = useUnsuspendVendorMutation();
  const status = vendorStatus(vendor);
  const busy = approving || suspending || resuming;

  const handlePause = () => {
    const reason = window.prompt(`Reason for pausing ${vendor.businessName}? (shown to the vendor, optional)`);
    if (reason === null) return; // cancelled
    suspendVendor({ id: vendor._id, reason });
  };

  return (
    <div className="card p-4">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800">{vendor.businessName}</p>
            <span className={status.tone}>{status.label}</span>
            {vendor.subscriptionPlan === 'pro' && <span className="badge-amber">⭐ Pro</span>}
          </div>
          <p className="text-xs text-slate-500 mt-1">{vendor.user?.name} &middot; {vendor.user?.email} &middot; {vendor.user?.phone}</p>
          <p className="text-xs text-slate-500 mt-0.5">🛡️ FSSAI: {vendor.fssaiLicense}</p>
          {vendor.kitchenLocation?.address && <p className="text-xs text-slate-400 mt-0.5">📍 {vendor.kitchenLocation.address}</p>}
          <p className="text-xs text-slate-400 mt-1">
            ★ {vendor.averageRating?.toFixed?.(1) ?? 0} ({vendor.ratingCount || 0}) &middot; {vendor.totalOrdersCompleted || 0} orders &middot;{' '}
            {vendor.deliveryEnabled ? `🛵 delivery up to ${vendor.maxDeliveryRadiusKm}km` : '🥡 takeaway only'}
          </p>
          {vendor.isSuspendedByAdmin && vendor.suspensionReason && (
            <p className="text-xs text-red-600 mt-1 bg-red-50 rounded-lg px-2 py-1 inline-block">Reason: {vendor.suspensionReason}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to={`/admin/vendors/${vendor._id}`} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold">
            View details
          </Link>
          {vendor.isSuspendedByAdmin ? (
            <button disabled={busy} onClick={() => unsuspendVendor(vendor._id)} className="btn-primary text-xs px-3 py-1.5">
              Resume
            </button>
          ) : vendor.isApproved ? (
            <button disabled={busy} onClick={handlePause} className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold">
              Pause
            </button>
          ) : vendor.rejectedAt ? (
            <button disabled={busy} onClick={() => approveVendor(vendor._id)} className="btn-primary text-xs px-3 py-1.5">
              Re-approve
            </button>
          ) : (
            <span className="text-xs text-slate-400 self-center">See pending queue above</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: allVendors, isLoading: allVendorsLoading } = useGetAllVendorsQuery();
  const { data: pending, isLoading: pendingLoading } = useGetPendingVendorsQuery();
  const { data: settings } = useGetAdminSettingsQuery();
  const [updateSettings, { isSuccess }] = useUpdateAdminSettingsMutation();
  const { data: overview } = useGetAdminOverviewQuery();

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (!form) return <p className="p-4 text-slate-500">Loading admin console...</p>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">🧭 Admin console</h1>

      {overview && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card px-4 py-3 text-center">
            <p className="text-xl font-bold text-slate-800">₹{overview.gmv}</p>
            <p className="text-xs text-slate-500">GMV ({overview.totalOrders} orders)</p>
          </div>
          <div className="card px-4 py-3 text-center">
            <p className="text-xl font-bold text-orange-600">₹{overview.commissionCollected}</p>
            <p className="text-xs text-slate-500">Commission collected</p>
          </div>
          <div className="card px-4 py-3 text-center">
            <p className="text-xl font-bold text-emerald-600">₹{overview.vendorPayoutsOwed}</p>
            <p className="text-xs text-slate-500">Vendor payouts (completed)</p>
          </div>
          <div className="card px-4 py-3 text-center">
            <p className="text-xl font-bold text-slate-800">{overview.totalVendors}</p>
            <p className="text-xs text-slate-500">Total vendors</p>
          </div>
          <div className="card px-4 py-3 text-center">
            <p className="text-xl font-bold text-amber-600">{overview.pendingVendors}</p>
            <p className="text-xs text-slate-500">Pending approval</p>
          </div>
          <div className="card px-4 py-3 text-center">
            <p className="text-xl font-bold text-purple-600">{overview.proVendors}</p>
            <p className="text-xs text-slate-500">Pro-tier vendors</p>
          </div>
        </div>
      )}

      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-slate-800 mb-3">⚙️ Platform settings</h2>
        <label className="flex items-center justify-between text-sm font-medium text-slate-700 mb-4">
          🛵 Delivery rollout enabled platform-wide
          <Toggle checked={form.deliveryRolloutEnabled} onChange={(v) => setForm((f) => ({ ...f, deliveryRolloutEnabled: v }))} />
        </label>
        <p className="text-xs text-slate-400 -mt-3 mb-4">
          When off, every vendor's Delivery option is unavailable regardless of their own setting — lets rollout be sequenced
          Takeaway/Pre-book first, market by market.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="text-sm flex flex-col gap-1">
            Free-tier commission
            <input type="number" step="0.01" min="0" max="1" value={form.platformCommissionRateFree}
              onChange={(e) => setForm((f) => ({ ...f, platformCommissionRateFree: Number(e.target.value) }))} className="input py-1.5" />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Pro-tier commission
            <input type="number" step="0.01" min="0" max="1" value={form.platformCommissionRatePro}
              onChange={(e) => setForm((f) => ({ ...f, platformCommissionRatePro: Number(e.target.value) }))} className="input py-1.5" />
          </label>
        </div>
        <label className="text-sm flex flex-col gap-1 mb-4">
          Pro subscription price (₹/month)
          <input type="number" min="0" value={form.proSubscriptionPricePerMonth}
            onChange={(e) => setForm((f) => ({ ...f, proSubscriptionPricePerMonth: Number(e.target.value) }))} className="input py-1.5" />
        </label>
        <button onClick={() => updateSettings(form)} className="btn-primary px-4 py-2 text-sm">Save settings</button>
        {isSuccess && <p className="text-green-600 text-sm mt-2">✓ Saved.</p>}
      </div>

      <h2 className="font-semibold text-slate-800 mb-3">🏪 Vendors awaiting approval</h2>
      <div className="flex flex-col gap-3 mb-8">
        {pendingLoading && <p className="text-slate-500 text-sm">Loading...</p>}
        {pending?.map((v) => <PendingVendorCard key={v._id} vendor={v} />)}
        {pending && pending.length === 0 && <p className="text-slate-500 text-sm">No vendors waiting — all caught up.</p>}
      </div>

      <h2 className="font-semibold text-slate-800 mb-3">🗂️ All vendors ({allVendors?.length ?? '...'})</h2>
      <p className="text-xs text-slate-400 -mt-2 mb-3">
        Full oversight of every kitchen on the platform — click "View details" for their menu, sales per item, and earnings, or
        pause any of them at any point. Pausing overrides the vendor's own open/closed toggle, so they can't undo it themselves;
        they're emailed either way.
      </p>
      <div className="flex flex-col gap-3">
        {allVendorsLoading && <p className="text-slate-500 text-sm">Loading...</p>}
        {allVendors?.map((v) => <AllVendorCard key={v._id} vendor={v} />)}
        {allVendors && allVendors.length === 0 && <p className="text-slate-500 text-sm">No vendors yet.</p>}
      </div>
    </div>
  );
}
