import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, AlertTriangle, MapPin, TrendingUp, Bell, ShieldAlert } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import AlertCard from '../components/dashboard/AlertCard';
import api from '../services/api';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { format, isValid } from 'date-fns';

const Dashboard = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    users: 0,
    rate: '94%'
  });
  const [isLoading, setIsLoading] = useState(true);

  // Safety date formatter
  const safeFormat = (date, formatStr) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : '--:--';
  };

  const fetchData = async () => {
    try {
      const [alertsRes, usersRes] = await Promise.all([
        api.get('/alerts'),
        api.get('/users')
      ]);
      
      const allAlerts = Array.isArray(alertsRes.data) ? alertsRes.data : [];
      setAlerts(allAlerts.slice(0, 4)); // Show latest 4
      
      setStats({
        total: allAlerts.length,
        active: allAlerts.filter(a => a.alertStatus === 'active').length,
        users: Array.isArray(usersRes.data) ? usersRes.data.length : 0,
        rate: '96%'
      });
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Socket.io for real-time alerts
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');

    socket.on('new-elephant-alert', (newAlert) => {
      // Show toast (moved outside state updater)
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Bell className="text-red-600" size={20} />
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold text-gray-900 uppercase">Emergency Alert</p>
                <p className="mt-1 text-sm text-gray-500">Elephant detected in {newAlert.areaName || newAlert.locationName || 'Unknown Location'}!</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      ), { duration: 10000 });

      // Prevent duplicates in state
      setAlerts(prev => {
        if (prev.find(a => (a.id || a._id) === (newAlert.id || newAlert._id))) return prev;
        
        // Update stats locally
        setStats(prevStats => ({
          ...prevStats,
          total: prevStats.total + 1,
          active: newAlert.alertStatus === 'active' ? prevStats.active + 1 : prevStats.active
        }));

        // Add new alert to list (keep only latest 4)
        return [newAlert, ...prev].slice(0, 4);
      });
    });

    socket.on('alert-updated', (updatedAlert) => {
      setAlerts(prev => prev.map(a => ((a.id || a._id) === (updatedAlert.id || updatedAlert._id)) ? updatedAlert : a));
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Guard Dashboard</h1>
          <p className="text-gray-500 text-sm">Real-time elephant detection overview for Sri Lanka.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          SYSTEM LIVE
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Alerts" value={stats.total} icon={<AlertTriangle className="text-amber-500" />} trend="+4%" />
        <StatCard title="Active Alerts" value={stats.active} icon={<MapPin className="text-red-500" />} />
        <StatCard title="Registered Users" value={stats.users} icon={<Users className="text-blue-500" />} />
        <StatCard title="Detection Accuracy" value={stats.rate} icon={<TrendingUp className="text-green-500" />} trend="+1%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Alerts List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
            Latest Detections
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {[1,2].map(i => <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-2xl"></div>)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-400">
              No recent detections found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map(alert => (
                <AlertCard key={alert._id || alert.id} alert={{
                  ...alert,
                  id: alert._id || alert.id,
                  locationName: alert.location?.locationName || alert.locationName,
                  coordinates: alert.location?.coordinates || [alert.longitude, alert.latitude],
                  detectedAt: alert.detectedAt,
                  confidence: alert.confidence,
                  status: alert.alertStatus,
                  image: alert.image
                }} />
              ))}
            </div>
          )}
        </div>

        {/* User Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Quick Actions</h2>
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/dashboard/delivery')}
                className="w-full p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-100"
              >
                <Bell size={18} /> Notification Tracker
              </button>
              <button 
                onClick={() => navigate('/dashboard/map')}
                className="w-full p-3 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition font-semibold flex items-center justify-center gap-2"
              >
                Open Live Map
              </button>
            </div>
          </div>

          <div className="bg-primary-700 p-6 rounded-xl text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold mb-2">Safety Protocol</h3>
              <p className="text-sm text-primary-100 leading-relaxed">
                Before clearing any alert, ensure the visual confirmation is logged and Telegram broadcasts have been received by at least 80% of local residents.
              </p>
            </div>
            <ShieldAlert className="absolute -right-4 -bottom-4 text-white/10" size={120} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
