import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layouts/MainLayout';

// Pages
import Home from '../pages/Home';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import LiveMap from '../pages/LiveMap';
import Detection from '../pages/Detection';
import UserManagement from '../pages/UserManagement';
import AlertHistory from '../pages/AlertHistory';
import Profile from '../pages/Profile';
import NotificationDashboard from '../pages/NotificationDashboard';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-primary-700">Loading Protection System...</div>;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected Guard Dashboard Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="map" element={<LiveMap />} />
        <Route path="map/:alertId" element={<LiveMap />} />
        <Route path="detection" element={<Detection />} />
        <Route path="history" element={<AlertHistory />} />
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
