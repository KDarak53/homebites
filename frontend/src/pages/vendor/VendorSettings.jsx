import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetMyVendorProfileQuery,
  useUpdateFulfillmentSettingsMutation,
  useInitiateProUpgradeMutation,
  useConfirmProUpgradeMutation,
} from '../../api/vendorApi';
import ImageUploader from '../../components/ImageUploader';
import { collectPayment } from '../../utils/razorpay';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
        checked ? 'bg-orange-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function ProUpgradeCard({ profile }) {
  const { user } = useSelector((s) => s.auth);
  const [initiateUpgrade, { isLoading: initiating }] = useInitiateProUpgradeMutation();
  const [confirmUpgrade, { isLoading: confirming }] = useConfirmProUpgradeMutation();
  const [error, setError] = useState('');
  const isLoading = initiating || confirming;

  const isPro = profile.subscriptionPlan === 'pro' && profile.subscriptionExpiresAt && new Date(profile.subscriptionExpiresAt) > new Date();

  const handleUpgrade = async () => {
    setError('');
    try {
      const paymentOrder = await initiateUpgrade().unwrap();
      const { paymentId, signature } = await collectPayment(paymentOrder, {
        description: 'HomeBites Pro — monthly',
        prefillEmail: user?.email,
      });
      await confirmUpgrade({ gatewayOrderId: paymentOrder.gatewayOrderId, paymentId, signature }).unwrap();
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Could not upgrade');
    }
  };

  return (
    <div className="card p-6 mb-6 bg-gradient-to-br from-amber-50 to-white border-amber-200">
      <h2 className="font-semibold text-slate-800 mb-1">⭐ HomeBites Pro</h2>
      {isPro ? (
        <p className="text-sm text-emerald-700">
          Active until {new Date(profile.subscriptionExpiresAt).toLocaleDateString()} — lower commission + priority placement in search.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600 mb-3">
            Lower per-order commission and priority placement ahead of free-tier vendors in customer search — for a flat monthly fee
            instead of a bigger cut of every order.
          </p>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <button onClick={handleUpgrade} disabled={isLoading} className="btn-primary text-sm px-4 py-2">
            {isLoading ? 'Processing...' : 'Upgrade to Pro'}
          </button>
        </>
      )}
    </div>
  );
}

export default function VendorSettings() {
  const { data: profile, isLoading } = useGetMyVendorProfileQuery();
  const [update, { isLoading: saving, isSuccess }] = useUpdateFulfillmentSettingsMutation();

  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [maxDeliveryRadiusKm, setMaxDeliveryRadiusKm] = useState(5);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [kitchenPhotoUrl, setKitchenPhotoUrl] = useState('');

  useEffect(() => {
    if (!profile) return;
    setDeliveryEnabled(profile.deliveryEnabled);
    setMaxDeliveryRadiusKm(profile.maxDeliveryRadiusKm);
    setDeliveryFee(profile.deliveryFee);
    setIsOpen(profile.isOpen);
    setKitchenPhotoUrl(profile.kitchenPhotoUrl || '');
  }, [profile]);

  if (isLoading || !profile) return <p className="p-4 text-slate-500">Loading settings...</p>;

  const handleSave = () => update({ deliveryEnabled, maxDeliveryRadiusKm, deliveryFee, isOpen });

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">⚙️ Fulfillment settings</h1>

      <ProUpgradeCard profile={profile} />

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-slate-800 mb-3">📷 Kitchen photo</h2>
        <p className="text-xs text-slate-400 mb-3">A real photo of your kitchen builds trust with customers who've never ordered from you before.</p>
        <ImageUploader
          value={kitchenPhotoUrl}
          onUploaded={(url) => {
            setKitchenPhotoUrl(url);
            update({ kitchenPhotoUrl: url });
          }}
          label="kitchen photo"
        />
      </div>

      <div className="card p-6 flex flex-col gap-5">
        <label className="flex items-center justify-between text-sm font-medium text-slate-700">
          {isOpen ? '🟢' : '🔴'} Kitchen open
          <Toggle checked={isOpen} onChange={setIsOpen} />
        </label>

        <label className="flex items-center justify-between text-sm font-medium text-slate-700">
          🛵 Delivery enabled (vs takeaway only)
          <Toggle checked={deliveryEnabled} onChange={setDeliveryEnabled} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Max delivery radius (km)
          <input
            type="number"
            min={0}
            max={50}
            disabled={!deliveryEnabled}
            value={maxDeliveryRadiusKm}
            onChange={(e) => setMaxDeliveryRadiusKm(Number(e.target.value))}
            className="input disabled:bg-slate-50 disabled:text-slate-400"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Delivery fee (₹)
          <input
            type="number"
            min={0}
            disabled={!deliveryEnabled}
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(Number(e.target.value))}
            className="input disabled:bg-slate-50 disabled:text-slate-400"
          />
        </label>

        <button onClick={handleSave} disabled={saving} className="btn-primary py-2.5 text-sm">
          {saving ? 'Saving...' : 'Save settings'}
        </button>
        {isSuccess && <p className="text-green-600 text-sm text-center font-medium">✓ Saved.</p>}
      </div>
    </div>
  );
}
