import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegisterVendorMutation, useResendVerificationMutation } from '../api/authApi';
import useGeolocation from '../hooks/useGeolocation';
import { DEFAULT_LOCATION } from '../constants';

function CheckYourEmail({ email, onEditEmail }) {
  const [resendVerification, { isLoading, isSuccess }] = useResendVerificationMutation();

  return (
    <div className="max-w-sm mx-auto mt-14 px-4 text-center">
      <div className="card p-8">
        <p className="text-4xl mb-3">📬</p>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Check your email</h1>
        <p className="text-slate-500 text-sm mb-2">
          We sent a verification link to <span className="font-semibold text-slate-700">{email}</span>. Open it to activate your
          account, then log in.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
          One more step after that: an admin needs to approve your kitchen before it's visible to customers.
        </p>
        <Link to="/login-vendor" className="btn-primary px-5 py-2 inline-flex mb-3">
          Go to login
        </Link>
        <p className="text-xs text-slate-400">
          Didn't get it?{' '}
          <button
            onClick={() => resendVerification({ email, role: 'vendor' })}
            disabled={isLoading}
            className="text-orange-600 font-semibold hover:text-orange-700 disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Resend email'}
          </button>
          {isSuccess && <span className="text-emerald-600"> · Sent!</span>}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Typo in the address?{' '}
          <button onClick={onEditEmail} className="text-orange-600 font-semibold hover:text-orange-700">
            Edit email
          </button>
        </p>
      </div>
    </div>
  );
}

export default function RegisterVendor() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
    fssaiLicense: '',
    address: '',
  });
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [registeredEmail, setRegisteredEmail] = useState(null);
  const { coords } = useGeolocation();
  const [registerVendor, { isLoading, error }] = useRegisterVendorMutation();

  useEffect(() => {
    if (coords) setLocation(coords);
  }, [coords]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await registerVendor({
        ...form,
        longitude: location.longitude,
        latitude: location.latitude,
      }).unwrap();
      setRegisteredEmail(data.email);
    } catch {
      // shown via `error`
    }
  };

  if (registeredEmail) return <CheckYourEmail email={registeredEmail} onEditEmail={() => setRegisteredEmail(null)} />;

  return (
    <div className="max-w-md mx-auto mt-10 px-4">
      <div className="text-center mb-5">
        <span className="text-4xl">👨‍🍳</span>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Register your kitchen</h1>
        <p className="text-slate-500 text-sm mt-1">Start serving home-cooked meals to your neighborhood.</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input placeholder="Your name" required value={form.name} onChange={update('name')} className="input" />
          <input type="email" placeholder="Email" required value={form.email} onChange={update('email')} className="input" />
          <input placeholder="Phone (10 digits)" required pattern="[6-9]\d{9}" value={form.phone} onChange={update('phone')} className="input" />
          <input type="password" placeholder="Password" required minLength={6} value={form.password} onChange={update('password')} className="input" />
          <input placeholder="Business name" required value={form.businessName} onChange={update('businessName')} className="input" />
          <input placeholder="FSSAI license number" required value={form.fssaiLicense} onChange={update('fssaiLicense')} className="input" />
          <input placeholder="Kitchen address" value={form.address} onChange={update('address')} className="input" />

          <div className="flex gap-2 text-sm">
            <label className="flex flex-col gap-1 flex-1 min-w-0">
              Kitchen latitude
              <input
                type="number"
                step="0.0001"
                value={location.latitude}
                onChange={(e) => setLocation((l) => ({ ...l, latitude: Number(e.target.value) }))}
                className="input py-1.5 w-full min-w-0"
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-0">
              Kitchen longitude
              <input
                type="number"
                step="0.0001"
                value={location.longitude}
                onChange={(e) => setLocation((l) => ({ ...l, longitude: Number(e.target.value) }))}
                className="input py-1.5 w-full min-w-0"
              />
            </label>
          </div>
          <p className="text-xs text-slate-400">
            📍 {coords ? 'Kitchen pin detected automatically — edit above if needed.' : 'Defaulted to a demo location — edit above, or allow location access to auto-detect.'}
          </p>

          {error && <p className="text-red-600 text-sm">{error.data?.message || 'Registration failed'}</p>}
          <button type="submit" disabled={isLoading} className="btn-primary py-2.5 mt-1">
            {isLoading ? 'Creating...' : 'Register as vendor'}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-4">
          Already have an account?{' '}
          <Link to="/login-vendor" className="text-orange-600 font-semibold hover:text-orange-700">Log in</Link>
        </p>
      </div>
    </div>
  );
}
