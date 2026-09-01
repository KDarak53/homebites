import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useVerifyEmailMutation } from '../api/authApi';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [verifyEmail, { isLoading, isSuccess, error, data }] = useVerifyEmailMutation();
  const [status, setStatus] = useState(token ? 'checking' : 'missing');
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true; // StrictMode/re-render guard — a token is single-use, don't burn it twice
    verifyEmail(token)
      .unwrap()
      .then(() => setStatus('success'))
      .catch(() => setStatus('failed'));
  }, [token, verifyEmail]);

  return (
    <div className="max-w-sm mx-auto mt-14 px-4 text-center">
      <div className="card p-8">
        {status === 'missing' && (
          <>
            <p className="text-4xl mb-3">🔗</p>
            <h1 className="text-xl font-bold text-slate-800 mb-2">No verification link</h1>
            <p className="text-slate-500 text-sm">Open this page from the link in your verification email.</p>
          </>
        )}
        {(status === 'checking' || isLoading) && (
          <>
            <p className="text-4xl mb-3">⏳</p>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Verifying...</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <p className="text-4xl mb-3">✅</p>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Email verified</h1>
            <p className="text-slate-500 text-sm mb-4">{data?.message || 'You can log in now.'}</p>
            <Link
              to={data?.role === 'vendor' ? '/login-vendor' : '/login'}
              className="btn-primary px-5 py-2 inline-flex"
            >
              Log in
            </Link>
          </>
        )}
        {status === 'failed' && (
          <>
            <p className="text-4xl mb-3">⚠️</p>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Link invalid or expired</h1>
            <p className="text-slate-500 text-sm">
              {error?.data?.message || 'This verification link no longer works — try logging in and requesting a new one.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
