import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { disconnectSocket } from '../api/socket';
import NotificationBell from './NotificationBell';

const linkClass = ({ isActive }) =>
  `px-1 pb-0.5 border-b-2 transition-colors ${
    isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-600 hover:text-orange-600'
  }`;

export default function Navbar() {
  const { user } = useSelector((state) => state.auth);
  const cartCount = useSelector((state) => state.cart.items.reduce((n, i) => n + i.quantity, 0));
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    const wasVendor = user?.role === 'vendor';
    disconnectSocket();
    dispatch(logout());
    navigate(wasVendor ? '/login-vendor' : '/login');
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/70 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      <NavLink to="/" className="flex items-center gap-1.5 text-xl font-bold text-orange-600 font-display">
        <span>🍲</span> HomeBites
      </NavLink>

      <div className="flex items-center gap-5 text-sm font-medium">
        {!user && (
          <>
            <NavLink to="/login" className={linkClass}>Login</NavLink>
            <NavLink to="/register" className={linkClass}>Sign up</NavLink>
            <span className="text-slate-300">|</span>
            <NavLink to="/login-vendor" className={linkClass}>Vendor login</NavLink>
            <NavLink to="/register-vendor" className="btn-primary text-xs px-3.5 py-1.5">
              Become a vendor
            </NavLink>
          </>
        )}

        {user?.role === 'customer' && (
          <>
            <NavLink to="/orders" className={linkClass}>Orders</NavLink>
            <NavLink to="/my-subscriptions" className={linkClass}>Subscriptions</NavLink>
            <NavLink to="/cart" className={({ isActive }) => `${linkClass({ isActive })} relative`}>
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-2.5 -right-3.5 bg-orange-600 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center shadow-sm animate-[bounce_1s_ease-in-out_1]">
                  {cartCount}
                </span>
              )}
            </NavLink>
          </>
        )}

        {user?.role === 'vendor' && (
          <>
            <NavLink to="/vendor/dashboard" className={linkClass}>Dashboard</NavLink>
            <NavLink to="/vendor/menu" className={linkClass}>Menu</NavLink>
            <NavLink to="/vendor/subscriptions" className={linkClass}>Subscriptions</NavLink>
            <NavLink to="/vendor/settings" className={linkClass}>Settings</NavLink>
          </>
        )}

        {user?.role === 'admin' && (
          <NavLink to="/admin" className={linkClass}>Console</NavLink>
        )}

        {user && (
          <>
            <NotificationBell />
            <NavLink to="/profile" className={linkClass}>
              👤 {user.name?.split(' ')[0]}
            </NavLink>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-600">
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
