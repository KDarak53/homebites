import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { disconnectSocket } from '../api/socket';
import NotificationBell from './NotificationBell';

const linkClass = ({ isActive }) =>
  `px-1 pb-0.5 border-b-2 transition-colors ${
    isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-600 hover:text-orange-600'
  }`;

// Same links, styled for a stacked full-width mobile drawer instead of an
// inline row — used by both the guest and logged-in mobile menus below.
const mobileLinkClass = ({ isActive }) =>
  `block px-3 py-2.5 rounded-xl font-medium ${isActive ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'}`;

export default function Navbar() {
  const { user } = useSelector((state) => state.auth);
  const cartCount = useSelector((state) => state.cart.items.reduce((n, i) => n + i.quantity, 0));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Every link in the drawer calls this on click (and logout does too) so
  // it never sits open over a page the user has already moved away from.
  const closeMobile = () => setMobileOpen(false);

  const handleLogout = () => {
    const wasVendor = user?.role === 'vendor';
    disconnectSocket();
    dispatch(logout());
    closeMobile();
    navigate(wasVendor ? '/login-vendor' : '/login');
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-20 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <NavLink to="/" onClick={closeMobile} className="flex items-center gap-1.5 text-xl font-bold text-orange-600 font-display shrink-0">
          <span>🍲</span> <span className="hidden xs:inline">HomeBites</span>
        </NavLink>

        {/* Desktop links — hidden below md, where the drawer takes over */}
        <div className="hidden md:flex items-center gap-5 text-sm font-medium">
          {/* Vendor login/register are deliberately not linked here (or in the
              mobile drawer below) — vendors reach /login-vendor and
              /register-vendor by direct link, kept separate from the
              customer-facing entry points rather than offered side by side. */}
          {!user && (
            <>
              <NavLink to="/login" className={linkClass}>Login</NavLink>
              <NavLink to="/register" className="btn-primary text-xs px-3.5 py-1.5">
                Sign up
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
                  <span className="absolute -top-2.5 -right-3.5 bg-orange-600 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center shadow-sm">
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

          {user?.role === 'admin' && <NavLink to="/admin" className={linkClass}>Console</NavLink>}

          {user && (
            <>
              <NotificationBell />
              <NavLink to="/profile" className={linkClass}>👤 {user.name?.split(' ')[0]}</NavLink>
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-600">Logout</button>
            </>
          )}
        </div>

        {/* Mobile controls — always-visible cart + bell (customers/logged-in),
            plus the hamburger that reveals everything else below. */}
        <div className="flex md:hidden items-center gap-3.5">
          {user?.role === 'customer' && (
            <NavLink to="/cart" onClick={closeMobile} className="relative text-slate-600 text-xl" aria-label="Cart">
              🛒
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-orange-600 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] px-1 flex items-center justify-center shadow-sm">
                  {cartCount}
                </span>
              )}
            </NavLink>
          )}
          {user && <NotificationBell />}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="text-2xl text-slate-700 leading-none w-8 h-8 flex items-center justify-center"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile drawer — plain block flow under the top bar, not an overlay,
          so it never floats over content or needs its own scroll handling. */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200/70 px-3 pb-3 pt-2 flex flex-col gap-0.5 bg-white">
          {!user && (
            <>
              <NavLink to="/login" onClick={closeMobile} className={mobileLinkClass}>Login</NavLink>
              <NavLink to="/register" onClick={closeMobile} className="btn-primary text-sm px-4 py-2.5 mt-1 justify-center">
                Sign up
              </NavLink>
            </>
          )}

          {user?.role === 'customer' && (
            <>
              <NavLink to="/orders" onClick={closeMobile} className={mobileLinkClass}>📦 Orders</NavLink>
              <NavLink to="/my-subscriptions" onClick={closeMobile} className={mobileLinkClass}>📅 Subscriptions</NavLink>
              <NavLink to="/cart" onClick={closeMobile} className={mobileLinkClass}>
                🛒 Cart{cartCount > 0 ? ` (${cartCount})` : ''}
              </NavLink>
            </>
          )}

          {user?.role === 'vendor' && (
            <>
              <NavLink to="/vendor/dashboard" onClick={closeMobile} className={mobileLinkClass}>📊 Dashboard</NavLink>
              <NavLink to="/vendor/menu" onClick={closeMobile} className={mobileLinkClass}>📋 Menu</NavLink>
              <NavLink to="/vendor/subscriptions" onClick={closeMobile} className={mobileLinkClass}>📅 Subscriptions</NavLink>
              <NavLink to="/vendor/settings" onClick={closeMobile} className={mobileLinkClass}>⚙️ Settings</NavLink>
            </>
          )}

          {user?.role === 'admin' && (
            <NavLink to="/admin" onClick={closeMobile} className={mobileLinkClass}>🛡️ Console</NavLink>
          )}

          {user && (
            <>
              <NavLink to="/profile" onClick={closeMobile} className={mobileLinkClass}>👤 {user.name}</NavLink>
              <button onClick={handleLogout} className="text-left px-3 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-50">
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
