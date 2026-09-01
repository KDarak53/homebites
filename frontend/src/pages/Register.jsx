import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegisterCustomerMutation, useResendVerificationMutation } from '../api/authApi';
import useGeolocation from '../hooks/useGeolocation';
import { DEFAULT_LOCATION } from '../constants';

function CheckYourEmail({ email }) {
  const [resendVerification, { isLoading, isSuccess }] = useResendVerificationMutation();

  return (
    <div className="max-w-sm mx-auto mt-14 px-4 text-center">
      <div className="card p-8">
        <p className="text-4xl mb-3">📬</p>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Check your email</h1>
        <p className="text-slate-500 text-sm mb-4">
          We sent a verification link to <span className="font-semibold text-slate-700">{email}</span>. Open it to activate your
          account, then log in.
        </p>
        <Link to="/login" className="btn-primary px-5 py-2 inline-flex mb-3">
          Go to login
        </Link>
        <p className="text-xs text-slate-400">
          Didn't get it?{' '}
          <button
            onClick={() => resendVerification({ email, role: 'customer' })}
            disabled={isLoading}
            className="text-orange-600 font-semibold hover:text-orange-700 disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Resend email'}
          </button>
          {isSuccess && <span className="text-emerald-600"> · Sent!</span>}
        </p>
      </div>
    </div>
  );
}

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', address: '' });
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [registeredEmail, setRegisteredEmail] = useState(null);
  const { coords } = useGeolocation();
  const [registerCustomer, { isLoading, error }] = useRegisterCustomerMutation();

  useEffect(() => {
    if (coords) setLocation(coords);
  }, [coords]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await registerCustomer({
        ...form,
        longitude: location.longitude,
        latitude: location.latitude,
      }).unwrap();
      setRegisteredEmail(data.email);
    } catch {
      // shown via `error`
    }
  };

  if (registeredEmail) return <CheckYourEmail email={registeredEmail} />;

  return (
    <div className="max-w-sm mx-auto mt-10 px-4">
      <div className="text-center mb-5">
        <span className="text-4xl">🎉</span>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Create your account</h1>
        <p className="text-slate-500 text-sm mt-1">Join HomeBites to order from local home kitchens.</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input placeholder="Full name" required value={form.name} onChange={update('name')} className="input" />
          <input type="email" placeholder="Email" required value={form.email} onChange={update('email')} className="input" />
          <input placeholder="Phone (10 digits)" required pattern="[6-9]\d{9}" value={form.phone} onChange={update('phone')} className="input" />
          <input type="password" placeholder="Password" required minLength={6} value={form.password} onChange={update('password')} className="input" />
          <input placeholder="Delivery address (optional)" value={form.address} onChange={update('address')} className="input" />

          <div className="flex gap-2 text-sm">
            <label className="flex flex-col gap-1 flex-1 min-w-0">
              Latitude
              <input
                type="number"
                step="0.0001"
                value={location.latitude}
                onChange={(e) => setLocation((l) => ({ ...l, latitude: Number(e.target.value) }))}
                className="input py-1.5 w-full min-w-0"
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-0">
              Longitude
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
            📍 {coords ? 'Location detected automatically — edit above if needed.' : 'Defaulted to a demo location — edit above, or allow location access to auto-detect.'}
          </p>

          {error && <p className="text-red-600 text-sm">{error.data?.message || 'Registration failed'}</p>}
          <button type="submit" disabled={isLoading} className="btn-primary py-2.5 mt-1">
            {isLoading ? 'Creating...' : 'Sign up'}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-600 font-semibold hover:text-orange-700">Log in</Link>
        </p>
      </div>
    </div>
  );
}
