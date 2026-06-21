import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, AlertTriangle, MapPin, TrendingUp, Bell, 
  ShieldAlert, Activity, ChevronRight, Clock, Navigation, 
  CheckCircle, Shield, Zap, Search, Info
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import api, { unwrapApiData } from '../services/api';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { format, isValid } from 'date-fns';

const Dashboard = () => {
  const [detections, setDetections] = useState([]);
  const [stats, setStats] = useState({
    totalDetections: 0,
    activeResidents: 0,
    geofenceZones: 0,
    deliveryCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDashboardData = useCallback(async () => {
    try {
      const [detRes, usersRes, deliveryRes] = await Promise.all([
        api.get('/detections'),
        api.get('/users'),
        api.get('/deliveries')
      ]);
      
      const detectionsPayload = unwrapApiData(detRes);
      const usersPayload = unwrapApiData(usersRes);
      const deliveryPayload = unwrapApiData(deliveryRes);

      const detectionsData = Array.isArray(detectionsPayload)
        ? detectionsPayload
        : (Array.isArray(detectionsPayload?.detections) ? detectionsPayload.detections : []);
      const usersData = Array.isArray(usersPayload)
        ? usersPayload
        : (Array.isArray(usersPayload?.residents) ? usersPayload.residents : []);
      const deliveryData = deliveryPayload?.success && Array.isArray(deliveryPayload.events)
        ? deliveryPayload.events
        : [];

      setDetections(detectionsData.slice(0, 10));
      
      const totalDetections = detectionsData.length;
      const activeResidents = usersData.length;
      const zones = [...new Set(usersData.map(u => u?.village || 'Unknown'))].length;
      
      const totalSent = deliveryData.reduce((acc, event) => acc + (event.summary?.sent || 0), 0);
      
      setStats({
        totalDetections,
        activeResidents,
        geofenceZones: zones,
        deliveryCount: totalSent,
      });
    } catch (error) {
      console.error('Dashboard sync error:', error);
      toast.error('Failed to sync dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const guardId = userData.id || userData._id;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    
    if (guardId) {
      socket.emit('join', guardId);
    }

    // Listener for new detections
    const handleNewDetection = (newDetection) => {
      const normalized = newDetection.detection || newDetection;
      setDetections(prev => {
        const exists = prev.some(d => d.id === normalized.id);
        if (exists) return prev;
        return [normalized, ...prev.slice(0, 9)];
      });
      setStats(prev => ({ ...prev, totalDetections: prev.totalDetections + 1 }));
      toast('ALERT: New Elephant Detection', { icon: '🐘', duration: 6000 });
    };

    socket.on('new-elephant-detection', handleNewDetection);
    socket.on('new-detection', handleNewDetection);

    socket.on('detection-status-updated', (data) => {
      setDetections(prev => prev.map(d => d.id === data.detectionId ? { ...d, status: data.status } : d));
    });

    return () => {
      socket.off('new-elephant-detection');
      socket.off('new-detection');
      socket.off('detection-status-updated');
      socket.disconnect();
    };
  }, [fetchDashboardData]);

  const safeFormat = (date, formatStr) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : 'N/A';
  };

  const latestDetection = detections.length > 0 ? detections[0] : null;

  return (
    <div className="space-y-[14px] pb-12 page-fade-in max-w-[1920px] mx-auto">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
        <StatCard 
          title="Total Detections" 
          value={stats.totalDetections} 
          icon={<Activity />} 
          trend="Overall"
          colorClass="bg-[#eaf2ff] text-[#1768d1]"
        />
        <StatCard 
          title="Active Alerts" 
          value={detections.filter(d => d?.status === 'active').length} 
          icon={<AlertTriangle />} 
          trend="Current"
          colorClass="bg-[#fff1f1] text-[#c81e1e]"
        />
        <StatCard 
          title="Registered Residents" 
          value={stats.activeResidents} 
          icon={<Users />} 
          trend="Active"
          colorClass="bg-[#edfcf4] text-[#0e7a42]"
        />
        <StatCard 
          title="Alerts Delivered" 
          value={stats.deliveryCount} 
          icon={<CheckCircle />} 
          trend="Total"
          colorClass="bg-[#fff9e8] text-[#b76300]"
        />
      </div>

      {/* Main Grid: Recent Detections | Map | Latest Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.85fr)_minmax(520px,1.8fr)_minmax(300px,0.95fr)] gap-[14px]">
        
        {/* Recent Detections */}
        <div className="card flex flex-col h-[520px]">
          <div className="px-5 py-[14px] border-b border-[#dfe7f1] flex items-center justify-between shrink-0">
             <h2 className="text-[13px] font-[700] text-[#334155] uppercase tracking-widest">Recent Detections</h2>
             <Link to="/dashboard/history" className="p-1 hover:bg-[#f8fafc] rounded-[5px] text-[#1768d1] transition-colors">
                <ChevronRight size={18} />
             </Link>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#edf1f6]">
            {isLoading ? (
               Array(6).fill(0).map((_, i) => <div key={i} className="h-[78px] bg-[#f8fafc] animate-pulse"></div>)
            ) : detections.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3 opacity-40">
                  <Activity size={32} className="text-[#94a3b8]" />
                  <p className="text-[10px] font-[700] uppercase tracking-widest text-[#64748b]">No detections logged</p>
               </div>
            ) : (
               detections.map(det => (
                 <button 
                   key={det?.id || Math.random()}
                   onClick={() => det?.id && navigate(`/dashboard/history?highlight=${det.id}`)}
                   className="w-full p-4 grid grid-cols-[44px_1fr_auto] gap-3 items-center hover:bg-[#f8fafc] transition-colors text-left group"
                 >
                    <div className={`w-11 h-11 rounded-[5px] flex items-center justify-center border border-[#dfe7f1] shadow-sm transition-transform group-hover:scale-105 ${
                      det?.status === 'active' ? 'bg-[#fff1f1] text-[#c81e1e]' : 'bg-[#f1f5f9] text-[#64748b]'
                    }`}>
                       <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0">
                       <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[10px] font-[700] text-[#94a3b8] uppercase">{safeFormat(det?.detectedAt, 'HH:mm')}</span>
                       </div>
                       <h4 className="text-[13.5px] font-[700] text-[#0f172a] truncate leading-tight">{det?.locationName || 'Unknown'}</h4>
                       <p className="text-[10px] font-[600] text-[#64748b] truncate mt-1">
                         {((det?.confidence || 0) * 100).toFixed(0)}% Confidence · {(det?.status || 'UNKNOWN').toUpperCase()}
                       </p>
                    </div>
                    <ChevronRight size={14} className="text-[#cbd5e1] group-hover:text-[#1768d1] transition-colors" />
                 </button>
               ))
            )}
          </div>
        </div>

        {/* Map Preview */}
        <div className="card h-[520px] relative overflow-hidden">
           <div className="px-5 py-[14px] border-b border-[#dfe7f1] flex items-center justify-between shrink-0 absolute top-0 left-0 right-0 z-10 bg-white/95">
              <h2 className="text-[13px] font-[700] text-[#334155] uppercase tracking-widest flex items-center gap-2">
                 <div className="w-2 h-2 bg-[#ef3535] rounded-full animate-pulse"></div>
                 Live Map Preview
              </h2>
           </div>
           
           <div className="w-full h-full pt-[50px]">
              <div className="w-full h-full bg-[#f1f5f9] relative overflow-hidden flex flex-col items-center justify-center group cursor-pointer" onClick={() => navigate('/dashboard/map')}>
                 <div className="absolute inset-0 bg-[url('https://tiles.stadiamaps.com/tiles/alidade_smooth/7/80.7718/7.8731.png')] bg-cover bg-center grayscale contrast-[0.8] opacity-60 group-hover:opacity-100 transition-all duration-1000"></div>
                 <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-[5px] shadow-2xl flex items-center justify-center text-[#1768d1] border border-[#dfe7f1]">
                       <MapPin size={32} />
                    </div>
                    <button className="h-11 px-8 bg-[#1768d1] text-white rounded-[5px] font-[600] text-[14px] shadow-xl shadow-[#1768d1]/20 group-hover:bg-[#0f56b3] transition-colors">
                       Open Live Map
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* Latest Detection Detail */}
        <div className="card lg:h-[520px] flex flex-col overflow-hidden">
           <div className="px-5 py-[14px] border-b border-[#dfe7f1] flex items-center justify-between shrink-0">
              <h2 className="text-[13px] font-[700] text-[#334155] uppercase tracking-widest">Latest Detection</h2>
              {latestDetection?.status === 'active' && (
                <span className="badge badge-danger">Active</span>
              )}
           </div>
           
           {isLoading ? (
             <div className="flex-1 bg-[#f8fafc] animate-pulse"></div>
           ) : !latestDetection ? (
             <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4 opacity-50">
                <div className="w-20 h-20 bg-[#f1f5f9] rounded-[5px] flex items-center justify-center text-[#cbd5e1] border border-[#dfe7f1]">
                   <Shield size={40} />
                </div>
                <p className="text-[11px] font-[700] uppercase tracking-widest text-[#64748b]">Awaiting Detection...</p>
             </div>
           ) : (
             <div className="p-6 flex-1 flex flex-col min-h-0">
                <div className="flex flex-col items-center text-center space-y-4 mb-5 shrink-0">
                   <div className="w-full aspect-video rounded-[5px] overflow-hidden border border-[#dfe7f1] shadow-md relative bg-slate-100">
                      <img 
                        src={latestDetection?.image ? (latestDetection.image.startsWith('http') ? latestDetection.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${latestDetection.image}`) : '/assets/images/elephant-fallback.jpg'} 
                        alt="Detection" 
                        className="w-full h-full object-cover"
                      />
                   </div>
                   <div className="w-full text-left">
                      <h3 className="text-[16px] font-[800] text-[#0f172a] leading-tight truncate">{latestDetection?.locationName || 'Unknown'}</h3>
                      <p className="text-[10px] font-[600] text-[#64748b] uppercase tracking-widest mt-1.5">{safeFormat(latestDetection?.detectedAt, 'PPP p')}</p>
                   </div>
                </div>
                
                <div className="space-y-0.5 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                   {[
                     { label: 'Detection Status', value: (latestDetection?.status || 'UNKNOWN').toUpperCase(), color: latestDetection?.status === 'active' ? 'text-[#ef3535]' : 'text-[#119c55]' },
                     { label: 'Patrol Area', value: latestDetection?.insideGuardArea ? 'INSIDE' : 'OUTSIDE', color: latestDetection?.insideGuardArea ? 'text-[#e02424]' : 'text-[#64748b]' },
                   ].map((row, i) => (
                     <div key={i} className="flex justify-between items-center py-3 border-b border-[#edf1f6] last:border-0">
                        <span className="text-[10px] font-[700] text-[#64748b] uppercase tracking-widest">{row.label}</span>
                        <span className={`text-[12px] font-[800] tracking-tight ${row.color}`}>{row.value}</span>
                     </div>
                   ))}
                </div>
                
                <div className="pt-4 mt-auto shrink-0">
                   <button 
                     onClick={() => latestDetection?.id && navigate(`/dashboard/history?highlight=${latestDetection.id}`)}
                     className="w-full h-11 bg-[#1768d1] text-white rounded-[5px] font-[700] text-[12px] uppercase tracking-wider shadow-lg shadow-[#1768d1]/10 hover:bg-[#0f56b3] transition-colors"
                   >
                      View Detection Details
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
