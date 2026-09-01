import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetMeQuery, useUpdateMeMutation } from '../api/authApi';
import { useGetMyOrdersQuery } from '../api/orderApi';
import useGeolocation from '../hooks/useGeolocation';

export default function Profile() {
  const { user } = useSelector((s) => s.auth);
  const { data: me, isLoading } = useGetMeQuery();
  const [updateMe, { isLoading: saving, isSuccess, error }] = useUpdateMeMutation();
  const { coords } = useGeolocation();

  const [form, setForm] = useState({ name: '', phone: '', address: '', latitude: '', longitude: '' });

  useEffect(() => {
    if (me) {
      setForm({
        name: me.name || '',
        phone: me.phone || '',
        address: me.location?.address || '',
        latitude: me.location?.coordinates?.[1] ?? '',
        longitude: me.location?.coordinates?.[0] ?? '',
      });
    }
  }, [me]);

  // Only customers get an order history; a customer's "orders completed" and
  // "rated" counts are useful to surface right here on their profile.
  const { data: orders } = useGetMyOrdersQuery(undefined, { skip: user?.role !== 'customer' });
  const completedOrders = orders?.filter((o) => o.status === 'Completed') || [];
  const ratedOrders = completedOrders.filter((o) => o.rating);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const useMyLocation = () => {
    if (coords) setForm((f) => ({ ...f, latitude: coords.latitude, longitude: coords.longitude }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMe({
      name: form.name,
      phone: form.phone,
      address: form.address,
      latitude: form.latitude === '' ? undefined : Number(form.latitude),
      longitude: form.longitude === '' ? undefined : Number(form.longitude),
    });
  };

  if (isLoading) return <p className="p-4 text-slate-500">Loading profile...</p>;

  const initials = (me?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xl font-bold shadow-inner shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{me?.name || 'My Profile'}</h1>
          <p className="text-slate-500 text-sm capitalize">{me?.role} account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-3 mb-6">
        <label className="text-sm flex flex-col gap-1">
          Email
          <input value={me?.email || ''} disabled className="input bg-slate-50 text-slate-500" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          Full name
          <input value={form.name} onChange={update('name')} required className="input" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          Phone
          <input value={form.phone} onChange={update('phone')} pattern="[6-9]\d{9}" required className="input" />
        </label>
        <label className="text-sm flex flex-col gap-1">
          {user?.role === 'vendor' ? 'Home address' : 'Default delivery address'}
          <input value={form.address} onChange={update('address')} className="input" />
        </label>

        <div className="flex gap-2">
          <label className="text-sm flex flex-col gap-1 flex-1 min-w-0">
            Latitude
            <input type="number" step="0.0001" value={form.latitude} onChange={update('latitude')} className="input py-1.5 w-full min-w-0" />
          </label>
          <label className="text-sm flex flex-col gap-1 flex-1 min-w-0">
            Longitude
            <input type="number" step="0.0001" value={form.longitude} onChange={update('longitude')} className="input py-1.5 w-full min-w-0" />
          </label>
        </div>
        {coords && (
          <button type="button" onClick={useMyLocation} className="text-xs text-orange-600 font-medium text-left hover:text-orange-700">
            📍 Use my current detected location
          </button>
        )}

        {error && <p className="text-red-600 text-sm">{error.data?.message || 'Could not update profile'}</p>}
        {isSuccess && <p className="text-green-600 text-sm">✓ Profile updated.</p>}

        <button type="submit" disabled={saving} className="btn-primary py-2.5 mt-1">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {user?.role === 'customer' && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-3">🧾 Order history & ratings</h2>
          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-orange-600">{orders?.length || 0}</p>
              <p className="text-xs text-slate-500">Total orders</p>
            </div>
            <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{completedOrders.length}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
            <div className="flex-1 bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{ratedOrders.length}</p>
              <p className="text-xs text-slate-500">Rated</p>
            </div>
          </div>
          <Link to="/orders" className="text-sm text-orange-600 font-semibold hover:text-orange-700">
            View full order history & rate orders →
          </Link>
        </div>
      )}

      {user?.role === 'vendor' && (
        <div className="card p-6 flex flex-col gap-1">
          <h2 className="font-semibold text-slate-800 mb-2">🏪 Business</h2>
          <Link to="/vendor/dashboard" className="text-sm text-orange-600 font-semibold hover:text-orange-700 py-1">📊 Order dashboard & analytics →</Link>
          <Link to="/vendor/menu" className="text-sm text-orange-600 font-semibold hover:text-orange-700 py-1">📋 Manage menu →</Link>
          <Link to="/vendor/settings" className="text-sm text-orange-600 font-semibold hover:text-orange-700 py-1">⚙️ Business & fulfillment settings →</Link>
        </div>
      )}
    </div>
  );
}
