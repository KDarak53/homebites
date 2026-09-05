import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Navbar from './components/Navbar';
import ProtectedRoute from './routes/ProtectedRoute';

import Login from './pages/Login';
import LoginVendor from './pages/LoginVendor';
import LoginAdmin from './pages/LoginAdmin';
import Register from './pages/Register';
import RegisterVendor from './pages/RegisterVendor';
import VerifyEmail from './pages/VerifyEmail';
import Restaurants from './pages/Restaurants';
import VendorMenu from './pages/VendorMenu';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import MySubscriptions from './pages/MySubscriptions';
import AdminDashboard from './pages/AdminDashboard';
import AdminVendorDetail from './pages/AdminVendorDetail';

import VendorDashboard from './pages/vendor/VendorDashboard';
import MenuManagement from './pages/vendor/MenuManagement';
import VendorSettings from './pages/vendor/VendorSettings';
import VendorSubscriptions from './pages/vendor/VendorSubscriptions';

// "/" behaves differently by who's asking: a guest (fresh visit, nobody
// logged in) lands on the login page rather than browsing the marketplace
// unauthenticated; a logged-in vendor/admin goes to their own console
// instead of the customer discovery page; only a logged-in customer
// actually sees it.
function Home() {
  const { user } = useSelector((state) => state.auth);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'vendor') return <Navigate to="/vendor/dashboard" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return <Restaurants />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login-vendor" element={<LoginVendor />} />
        <Route path="/login-admin" element={<LoginAdmin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register-vendor" element={<RegisterVendor />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/vendors/:id" element={<VendorMenu />} />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cart"
          element={
            <ProtectedRoute role="customer">
              <Cart />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute role="customer">
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-subscriptions"
          element={
            <ProtectedRoute role="customer">
              <MySubscriptions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/vendor/dashboard"
          element={
            <ProtectedRoute role="vendor">
              <VendorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/menu"
          element={
            <ProtectedRoute role="vendor">
              <MenuManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/subscriptions"
          element={
            <ProtectedRoute role="vendor">
              <VendorSubscriptions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/settings"
          element={
            <ProtectedRoute role="vendor">
              <VendorSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/vendors/:id"
          element={
            <ProtectedRoute role="admin">
              <AdminVendorDetail />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
