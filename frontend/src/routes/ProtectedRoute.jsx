import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ role, children }) {
  const { user } = useSelector((state) => state.auth);

  if (!user) {
    const loginPath = role === 'vendor' ? '/login-vendor' : role === 'admin' ? '/login-admin' : '/login';
    return <Navigate to={loginPath} replace />;
  }
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
