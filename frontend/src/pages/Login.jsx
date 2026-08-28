import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useLoginMutation } from '../api/authApi';
import { setCredentials } from '../store/slices/authSlice';

const DEMO_EMAIL = 'demo.customer@homebites.test';
const DEMO_PASSWORD = 'password123';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const doLogin = async (loginEmail, loginPassword) => {
    try {
      const data = await login({ email: loginEmail, password: loginPassword }).unwrap();
      dispatch(setCredentials(data));
      navigate('/');
    } catch {
      // error is shown from the `error` state below
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    doLogin(email, password);
  };

  return (
    <div className="max-w-sm mx-auto mt-14 px-4">
      <div className="text-center mb-5">
        <span className="text-4xl">🍲</span>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Welcome back</h1>
        <p className="text-slate-500 text-sm mt-1">Log in to order from home kitchens near you.</p>
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-2 mb-4 pb-4 border-b border-slate-100">
          <p className="text-xs text-slate-400">✨ Quick demo login (password: {DEMO_PASSWORD})</p>
          <button
            type="button"
            onClick={() => doLogin(DEMO_EMAIL, DEMO_PASSWORD)}
            disabled={isLoading}
            className="text-sm text-left px-3 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
          >
            👤 Demo customer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          {error && (
            <p className="text-red-600 text-sm">{error.data?.message || 'Login failed'}</p>
          )}
          <button type="submit" disabled={isLoading} className="btn-primary py-2.5 mt-1">
            {isLoading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-4">
          No account?{' '}
          <Link to="/register" className="text-orange-600 font-semibold hover:text-orange-700">
            Sign up as customer
          </Link>
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Are you a vendor?{' '}
          <Link to="/login-vendor" className="text-orange-600 font-semibold hover:text-orange-700">
            Log in here instead
          </Link>
        </p>
      </div>
    </div>
  );
}
