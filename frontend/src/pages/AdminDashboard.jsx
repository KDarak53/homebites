import { useEffect, useState } from 'react';
import {
  useGetPendingVendorsQuery,
  useApproveVendorMutation,
  useRejectVendorMutation,
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
  useGetAdminOverviewQuery,
} from '../api/adminApi';

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

  return (
    <div className="card p-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="font-semibold text-slate-800">{vendor.businessName}</p>
          <p className="text-xs text-slate-500">{vendor.user?.name} &middot; {vendor.user?.email} &middot; {vendor.user?.phone}</p>
          <p className="text-xs text-slate-500 mt-1">🛡️ FSSAI: {vendor.fssaiLicense}</p>
          {vendor.kitchenLocation?.address && <p className="text-xs text-slate-400">📍 {vendor.kitchenLocation.address}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button disabled={approving} onClick={() => approveVendor(vendor._id)} className="btn-primary text-xs px-3 py-1.5">
            Approve
          </button>
          <button disabled={rejecting} onClick={() => rejectVendor({ id: vendor._id })} className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 font-semibold">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
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
      <div className="flex flex-col gap-3">
        {pendingLoading && <p className="text-slate-500 text-sm">Loading...</p>}
        {pending?.map((v) => <PendingVendorCard key={v._id} vendor={v} />)}
        {pending && pending.length === 0 && <p className="text-slate-500 text-sm">No vendors waiting — all caught up.</p>}
      </div>
    </div>
  );
}
