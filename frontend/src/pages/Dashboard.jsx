import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, AlertTriangle, MapPin, TrendingUp, Bell, 
  ShieldAlert, Activity, ChevronRight, Clock, Navigation, 
  CheckCircle, Shield, Zap, Search, Info
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { format, isValid } from 'date-fns';

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
      
      const latestAlerts = alertsRes.data.slice(0, 10);
      setAlerts(latestAlerts);
      
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

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const guardId = userData.id || userData._id;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    
    if (guardId) {
      socket.emit('join', guardId);
    }

    socket.on('new-elephant-alert', (newAlert) => {
      setAlerts(prev => {
        const exists = prev.some(a => (a.id || a._id) === (newAlert.id || newAlert._id));
        if (exists) return prev;
        return [newAlert, ...prev.slice(0, 9)];
      });
      setStats(prev => ({ ...prev, totalAlerts: prev.totalAlerts + 1 }));
      toast('ALERT: New Elephant Detection', { icon: '🐘', duration: 6000 });
    });

    return () => socket.disconnect();
  }, []);

  const safeFormat = (date, formatStr) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : 'N/A';
  };

  const latestAlert = alerts.length > 0 ? alerts[0] : null;

  return (
    <div className="space-y-[14px] pb-12 page-fade-in max-w-[1920px] mx-auto">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
        <StatCard 
          title="Total Alerts" 
          value={stats.totalAlerts} 
          icon={<Activity />} 
          trend="Overall"
          colorClass="bg-[#eaf2ff] text-[#1768d1]"
        />
        <StatCard 
          title="Active Alerts" 
          value={alerts.filter(a => a.alertStatus === 'active').length || stats.totalAlerts > 0 ? 1 : 0} 
          icon={<AlertTriangle />} 
          trend="Critical"
          colorClass="bg-[#fff1f1] text-[#c81e1e]"
        />
        <StatCard 
          title="Registered Residents" 
          value={stats.activeResidents} 
          icon={<Users />} 
          trend="Live Nodes"
          colorClass="bg-[#edfcf4] text-[#0e7a42]"
        />
        <StatCard 
          title="Successful Deliveries" 
          value="482" 
          icon={<CheckCircle />} 
          trend="+94%"
          colorClass="bg-[#fff9e8] text-[#b76300]"
        />
      </div>

      {/* Main Grid: Recent Alerts | Map | Latest Detection */}
      <div 
        className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.85fr)_minmax(520px,1.8fr)_minmax(300px,0.95fr)] gap-[14px]"
      >
        {/* Recent Alerts (List) */}
        <div className="card flex flex-col h-[520px]">
          <div className="px-5 py-[14px] border-b border-[#dfe7f1] flex items-center justify-between shrink-0">
             <h2 className="text-[13px] font-[700] text-[#334155] uppercase tracking-widest">Recent Alerts</h2>
             <Link to="/dashboard/history" className="p-1 hover:bg-[#f8fafc] rounded-[5px] text-[#1768d1] transition-colors">
                <ChevronRight size={18} />
             </Link>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#edf1f6]">
            {isLoading ? (
               Array(6).fill(0).map((_, i) => <div key={i} className="h-[78px] bg-[#f8fafc] animate-pulse"></div>)
            ) : alerts.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3 opacity-40">
                  <Activity size={32} className="text-[#94a3b8]" />
                  <p className="text-[10px] font-[700] uppercase tracking-widest text-[#64748b]">No Alerts Logged</p>
               </div>
            ) : (
               alerts.map(alert => (
                 <button 
                   key={alert.id || alert._id}
                   onClick={() => navigate(`/dashboard/map/${alert.id || alert._id}`)}
                   className="w-full p-4 grid grid-cols-[44px_1fr_auto] gap-3 items-center hover:bg-[#f8fafc] transition-colors text-left group"
                 >
                    <div className={`w-11 h-11 rounded-[5px] flex items-center justify-center border border-[#dfe7f1] shadow-sm transition-transform group-hover:scale-105 ${
                      alert.insidePatrolArea ? 'bg-[#fff1f1] text-[#c81e1e]' : 'bg-[#f1f5f9] text-[#64748b]'
                    }`}>
                       <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0">
                       <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[10px] font-[700] text-[#94a3b8] uppercase">{safeFormat(alert.detectedAt, 'HH:mm')}</span>
                       </div>
                       <h4 className="text-[13.5px] font-[700] text-[#0f172a] truncate leading-tight">{alert.locationName || alert.areaName}</h4>
                       <p className="text-[10px] font-[600] text-[#64748b] truncate mt-1">
                         {alert.confidence ? (alert.confidence * 100).toFixed(0) : 0}% Confidence · {alert.insidePatrolArea ? 'Danger Zone' : 'Boundary'}
                       </p>
                    </div>
                    <ChevronRight size={14} className="text-[#cbd5e1] group-hover:text-[#1768d1] transition-colors" />
                 </button>
               ))
            )}
          </div>
        </div>

        {/* Tactical Map Preview */}
        <div className="card h-[520px] relative overflow-hidden">
           <div className="px-5 py-[14px] border-b border-[#dfe7f1] flex items-center justify-between shrink-0 absolute top-0 left-0 right-0 z-10 bg-white/95">
              <h2 className="text-[13px] font-[700] text-[#334155] uppercase tracking-widest flex items-center gap-2">
                 <div className="w-2 h-2 bg-[#ef3535] rounded-full animate-pulse"></div>
                 Live Tactical Map Preview
              </h2>
              <div className="flex gap-2">
                 <div className="px-2.5 py-1 bg-[#0f172a] text-white rounded-[5px] text-[10px] font-[700] uppercase tracking-widest border border-white/10 shadow-lg">
                    Sector Map
                 </div>
              </div>
           </div>
           
           <div className="w-full h-full pt-[50px]">
              <div className="w-full h-full bg-[#f1f5f9] relative overflow-hidden flex flex-col items-center justify-center group cursor-pointer" onClick={() => navigate('/dashboard/map')}>
                 <div className="absolute inset-0 bg-[url('https://tiles.stadiamaps.com/tiles/alidade_smooth/7/80.7718/7.8731.png')] bg-cover bg-center grayscale contrast-[0.8] opacity-60 group-hover:opacity-100 transition-all duration-1000"></div>
                 
                 <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-[5px] shadow-2xl flex items-center justify-center text-[#1768d1] border border-[#dfe7f1]">
                       <MapPin size={32} />
                    </div>
                    <button className="h-11 px-8 bg-[#1768d1] text-white rounded-[5px] font-[600] text-[14px] shadow-xl shadow-[#1768d1]/20 group-hover:bg-[#0f56b3] transition-colors">
                       Open Live Tactical Map
                    </button>
                 </div>
                 
                 <div className="absolute bottom-6 right-6 p-4 bg-[#0f172a]/95 backdrop-blur-sm rounded-[5px] border border-white/10 text-white space-y-2 min-w-[180px] shadow-2xl">
                    <div className="flex items-center justify-between gap-4">
                       <span className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest">Active Risks</span>
                       <span className="text-xs font-[800] text-[#ef3535]">{stats.totalAlerts}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                       <span className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest">Network Health</span>
                       <span className="text-xs font-[800] text-[#18b866]">STABLE</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Latest Detection Detail */}
        <div className="card h-[520px] flex flex-col">
           <div className="px-5 py-[14px] border-b border-[#dfe7f1] flex items-center justify-between shrink-0">
              <h2 className="text-[13px] font-[700] text-[#334155] uppercase tracking-widest">Latest Detection</h2>
              {latestAlert?.insidePatrolArea && (
                <span className="badge badge-danger">Danger</span>
              )}
           </div>
           
           {isLoading ? (
             <div className="flex-1 bg-[#f8fafc] animate-pulse"></div>
           ) : !latestAlert ? (
             <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4 opacity-50">
                <div className="w-20 h-20 bg-[#f1f5f9] rounded-[5px] flex items-center justify-center text-[#cbd5e1] border border-[#dfe7f1]">
                   <Shield size={40} />
                </div>
                <p className="text-[11px] font-[700] uppercase tracking-widest text-[#64748b]">Awaiting Telemetry...</p>
             </div>
           ) : (
             <div className="p-6 flex-1 flex flex-col">
                <div className="flex flex-col items-center text-center space-y-4 mb-6">
                   <div className="w-full aspect-video rounded-[5px] overflow-hidden border border-[#dfe7f1] shadow-md relative bg-slate-100">
                      <img 
                        src={latestAlert.image ? (latestAlert.image.startsWith('http') ? latestAlert.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${latestAlert.image}`) : '/assets/images/elephant-fallback.jpg'} 
                        alt="Detection" 
                        className="w-full h-full object-cover"
                      />
                   </div>
                   <div className="w-full text-left">
                      <h3 className="text-[16px] font-[800] text-[#0f172a] leading-tight truncate">{latestAlert.locationName || latestAlert.areaName}</h3>
                      <p className="text-[10px] font-[600] text-[#64748b] uppercase tracking-widest mt-1.5">{safeFormat(latestAlert.detectedAt, 'PPP p')}</p>
                   </div>
                </div>
                
                <div className="space-y-0.5 flex-1">
                   {[
                     { label: 'Neural Confidence', value: `${(latestAlert.confidence * 100).toFixed(1)}%`, color: 'text-[#1768d1]' },
                     { label: 'Transmission', value: latestAlert.alertStatus.toUpperCase(), color: 'text-[#119c55]' },
                     { label: 'Patrol Boundary', value: latestAlert.insidePatrolArea ? 'BREACHED' : 'OUTSIDE', color: latestAlert.insidePatrolArea ? 'text-[#e02424]' : 'text-[#64748b]' },
                     { label: 'Delivery Count', value: latestAlert.recipientCount || 0, color: 'text-[#0f172a]' },
                   ].map((row, i) => (
                     <div key={i} className="flex justify-between items-center py-3 border-b border-[#edf1f6] last:border-0">
                        <span className="text-[10px] font-[700] text-[#64748b] uppercase tracking-widest">{row.label}</span>
                        <span className={`text-[12px] font-[800] tracking-tight ${row.color}`}>{row.value}</span>
                     </div>
                   ))}
                   
                   <div className="pt-4 space-y-2">
                      <div className="flex justify-between text-[10px] font-[700] text-[#64748b] uppercase tracking-widest">
                         <span>AI Score</span>
                         <span>{(latestAlert.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#f1f5f9] rounded-full overflow-hidden">
                         <div className="h-full bg-[#1768d1] rounded-full transition-all duration-1000" style={{ width: `${latestAlert.confidence * 100}%` }}></div>
                      </div>
                   </div>
                </div>
                
                <button 
                  onClick={() => navigate(`/dashboard/map/${latestAlert.id || latestAlert._id}`)}
                  className="w-full mt-6 h-11 bg-[#e02424] text-white rounded-[5px] font-[700] text-[13px] uppercase tracking-wider shadow-lg shadow-[#e02424]/10 hover:bg-[#c81e1e] transition-colors"
                >
                   Respond to Alert
                </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
