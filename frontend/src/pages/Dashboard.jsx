import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, AlertTriangle, MapPin, TrendingUp, Bell, ShieldAlert, Activity, ChevronRight } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import AlertCard from '../components/dashboard/AlertCard';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

const Dashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalAlerts: 0,
    activeResidents: 0,
    geofenceZones: 0,
    detectionRate: '0%',
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      const [alertsRes, usersRes] = await Promise.all([
        api.get('/alerts'),
        api.get('/users')
      ]);
      
      const latestAlerts = alertsRes.data.slice(0, 5);
      setAlerts(latestAlerts);
      
      // Basic stat calculation with safety checks
      const alertsData = Array.isArray(alertsRes.data) ? alertsRes.data : [];
      const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];

      const totalAlerts = alertsData.length;
      const activeResidents = usersData.length;
      const zones = [...new Set(usersData.map(u => u?.village || 'Unknown'))].length;
      
      setStats({
        totalAlerts,
        activeResidents,
        geofenceZones: zones,
        detectionRate: totalAlerts > 0 ? '+12%' : '0%',
      });
    } catch (error) {
      toast.error('Failed to sync with command center');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const { user } = JSON.parse(localStorage.getItem('user') || '{}');
    const guardId = user?.id || user?._id;

    // Socket.io for real-time updates
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    
    if (guardId) {
      socket.emit('join', guardId);
    }

    socket.on('new-elephant-alert', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev.slice(0, 4)]);
      setStats(prev => ({ ...prev, totalAlerts: prev.totalAlerts + 1 }));
      toast('ALERT: New Elephant Detection', { icon: '🐘', duration: 6000 });
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="space-y-10 pb-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Operations <span className="text-primary-600">Overview</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Real-time monitoring and resident alert network</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard/detection')}
            className="btn btn-primary"
          >
            <Activity size={18} />
            Start Scan
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Detections" 
          value={stats.totalAlerts} 
          icon={<AlertTriangle className="text-primary-600" />} 
          trend={stats.detectionRate}
        />
        <StatCard 
          title="Active Residents" 
          value={stats.activeResidents} 
          icon={<Users className="text-primary-600" />} 
          trend="Live"
        />
        <StatCard 
          title="Geofence Nodes" 
          value={stats.geofenceZones} 
          icon={<MapPin className="text-primary-600" />} 
        />
        <StatCard 
          title="System Health" 
          value="98.2%" 
          icon={<TrendingUp className="text-primary-600" />} 
          trend="Stable"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Recent Alerts Section */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-primary-600 rounded-full"></div>
              Recent Alerts
            </h2>
            <button 
              onClick={() => navigate('/dashboard/history')}
              className="text-xs font-bold text-primary-600 hover:text-primary-700 uppercase tracking-widest flex items-center gap-1 transition-all"
            >
              View Archive
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-64 bg-white rounded-2xl border border-slate-100 animate-pulse"></div>
              ))
            ) : alerts.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 border-dashed text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                  <ShieldAlert size={32} />
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No active threats detected</p>
              </div>
            ) : (
              alerts.map(alert => (
                <AlertCard key={alert.id || alert._id} alert={alert} />
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar: Quick Actions & Status */}
        <div className="lg:col-span-4 space-y-8">
          {/* Status Panel */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-soft relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100 group-hover:bg-primary-600 group-hover:text-white transition-all duration-500">
                   <Bell size={20} className="text-primary-600 group-hover:text-white" />
                 </div>
                 <h3 className="font-bold text-slate-900">System Protocol</h3>
              </div>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                The monitoring system is active across all geofence nodes. Telegram relay is verified for all residents.
              </p>
              <div className="space-y-2">
                 <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-primary-100 transition-all">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Telegram Bot</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-success-600">
                      <div className="w-1.5 h-1.5 bg-success-600 rounded-full animate-pulse"></div>
                      Online
                    </span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-primary-100 transition-all">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI Model v4.2</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary-600">
                      <div className="w-1.5 h-1.5 bg-primary-600 rounded-full animate-pulse"></div>
                      Ready
                    </span>
                 </div>
              </div>
            </div>
          </div>

          {/* Map Preview Link */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-soft space-y-6 group cursor-pointer hover:border-primary-300 transition-all duration-300" onClick={() => navigate('/dashboard/map')}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Tactical Map</h3>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary-600 group-hover:text-white transition-all">
                <ChevronRight size={16} />
              </div>
            </div>
            <div className="h-40 bg-slate-100 rounded-2xl overflow-hidden relative">
               <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/80.7718,7.8731,10/400x200?access_token=pk.dummy')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all duration-700"></div>
               <div className="absolute inset-0 bg-primary-600/5 mix-blend-multiply"></div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 bg-primary-600 rounded-full animate-ping"></div>
                  <div className="w-4 h-4 bg-primary-600 rounded-full absolute top-0"></div>
               </div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">Click for Live Theater View</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
