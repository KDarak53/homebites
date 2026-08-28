import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useRegisterVendorMutation } from '../api/authApi';
import { setCredentials } from '../store/slices/authSlice';
import useGeolocation from '../hooks/useGeolocation';
import { DEFAULT_LOCATION } from '../constants';

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
  const { coords } = useGeolocation();
  const [registerVendor, { isLoading, error }] = useRegisterVendorMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

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
      dispatch(setCredentials(data));
      navigate('/vendor/dashboard');
    } catch {
      // shown via `error`
    }
  };

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
            <label className="flex flex-col gap-1 flex-1">
              Kitchen latitude
              <input
                type="number"
                step="0.0001"
                value={location.latitude}
                onChange={(e) => setLocation((l) => ({ ...l, latitude: Number(e.target.value) }))}
                className="input py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              Kitchen longitude
              <input
                type="number"
                step="0.0001"
                value={location.longitude}
                onChange={(e) => setLocation((l) => ({ ...l, longitude: Number(e.target.value) }))}
                className="input py-1.5"
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
          <Link to="/login" className="text-orange-600 font-semibold hover:text-orange-700">Log in</Link>
        </p>
      </div>
    </div>
  );
}
