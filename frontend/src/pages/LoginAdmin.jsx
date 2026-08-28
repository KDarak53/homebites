import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { apiSlice } from '../api/apiSlice';
import { setCredentials } from '../store/slices/authSlice';

export default function LoginAdmin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/login-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      dispatch(setCredentials(data));
      dispatch(apiSlice.util.resetApiState());
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-14 px-4">
      <div className="text-center mb-5">
        <span className="text-4xl">🧭</span>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Admin console</h1>
        <p className="text-slate-500 text-sm mt-1">Vendor moderation & platform settings.</p>
      </div>
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          <input type="password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={isLoading} className="btn-dark py-2.5 mt-1">
            {isLoading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-4">Demo admin: admin@homebites.test / password123</p>
      </div>
    </div>
  );
}
