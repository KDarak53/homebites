import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useLoginMutation, useResendVerificationMutation } from '../api/authApi';
import { setCredentials } from '../store/slices/authSlice';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const [resendVerification, { isLoading: resending, isSuccess: resent }] = useResendVerificationMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // The API returns 403 specifically for "right password, unverified email"
  // (401 covers wrong credentials) — that's what unlocks the resend link.
  const needsVerification = error?.status === 403;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login({ email, password }).unwrap();
      dispatch(setCredentials(data));
      navigate('/');
    } catch {
      // error is shown from the `error` state below
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-14 px-4">
      <div className="text-center mb-5">
        <span className="text-4xl">🍲</span>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">Welcome back</h1>
        <p className="text-slate-500 text-sm mt-1">Log in to order from home kitchens near you.</p>
      </div>

      <div className="card p-6">
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
            <div className="text-sm">
              <p className="text-red-600">{error.data?.message || 'Login failed'}</p>
              {needsVerification && (
                <button
                  type="button"
                  onClick={() => resendVerification({ email, role: 'customer' })}
                  disabled={resending}
                  className="text-orange-600 font-semibold hover:text-orange-700 disabled:opacity-50 mt-1"
                >
                  {resending ? 'Sending...' : 'Resend verification email'}
                </button>
              )}
              {resent && <span className="text-emerald-600"> · Sent!</span>}
            </div>
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
      </div>
    </div>
  );
}
