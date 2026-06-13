import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layouts/MainLayout';

// Pages
import Home from '../pages/Home';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import Dashboard from '../pages/Dashboard';
import LiveMap from '../pages/LiveMap';
import Detection from '../pages/Detection';
import UserManagement from '../pages/UserManagement';
import DetectionHistory from '../pages/AlertHistory';
import Profile from '../pages/Profile';
import NotificationDashboard from '../pages/NotificationDashboard';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 space-y-4">
      <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
      <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Authenticating Secure Link...</p>
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 space-y-4">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Initializing Secure Grid...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/dashboard" /> : <ForgotPassword />} />
      
      {/* Protected Guard Dashboard Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="map" element={<LiveMap />} />
        <Route path="map/:alertId" element={<LiveMap />} />
        <Route path="detection" element={<Detection />} />
        <Route path="history" element={<DetectionHistory />} />
        <Route path="delivery" element={<NotificationDashboard />} />
        <Route path="register-user" element={<UserManagement />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Redirect any unknown route to home */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

export default AppRoutes;
