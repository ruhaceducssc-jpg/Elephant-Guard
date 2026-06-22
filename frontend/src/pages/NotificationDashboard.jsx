import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, CheckCircle, XCircle, Clock, User, 
  ShieldAlert, Send, RotateCcw, Activity, Zap,
  RefreshCw, Info, AlertTriangle, ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

const NotificationDashboard = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [summary, setSummary] = useState({ total: 0, sent: 0, failed: 0, pending: 0, notSent: 0, protected: 0, helpRequests: 0 });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const safeFormat = (date, formatStr) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : '--:--';
  };

  const fetchDeliveryDetails = useCallback(async (alertId) => {
    if (!alertId) return;
    setIsDetailsLoading(true);
    try {
      const { data } = await api.get(`/deliveries/${alertId}`);
      if (data && data.success) {
        setDeliveries(data.deliveries || []);
        setSummary(data.summary || { total: 0, sent: 0, failed: 0, pending: 0, notSent: 0, protected: 0, helpRequests: 0 });
      }
    } catch (error) {
      console.error('Fetch details error:', error);
      toast.error('Failed to load delivery logs');
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

  const handleEventSelect = useCallback((event) => {
    if (!event) return;
    setSelectedEvent(event);
    if (event.alertId) {
      fetchDeliveryDetails(event.alertId);
    } else {
      setDeliveries([]);
      setSummary({ total: 0, sent: 0, failed: 0, pending: 0, notSent: 0, protected: 0, helpRequests: 0 });
    }
  }, [fetchDeliveryDetails]);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/deliveries');
      if (data && data.success && Array.isArray(data.events)) {
        setEvents(data.events);
        if (data.events.length > 0 && !selectedEvent) {
          handleEventSelect(data.events[0]);
        }
      }
    } catch (error) {
      console.error('Fetch events error:', error);
      toast.error('Failed to sync delivery events');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEvent, handleEventSelect]);

  useEffect(() => {
    fetchEvents();

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const guardId = userData.id || userData._id;

    const token = localStorage.getItem('token');
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
    });
    
    if (guardId) {
      socket.emit('join', guardId);
    }

    socket.on('new-detection', () => {
      fetchEvents();
    });

    socket.on('detection-status-updated', (data) => {
      setEvents(prev => prev.map(e => e.detectionId === data.detectionId ? { ...e, status: data.status } : e));
      if (selectedEvent && selectedEvent.detectionId === data.detectionId) {
        setSelectedEvent(prev => ({ ...prev, status: data.status }));
      }
    });

    socket.on('delivery-updated', (updated) => {
      setDeliveries(prev => {
        const index = prev.findIndex(d => d._id === updated._id);
        if (index !== -1) {
           const newDeliveries = [...prev];
           newDeliveries[index] = { ...newDeliveries[index], ...updated };
           return newDeliveries;
        }
        return prev;
      });
      // Optionally update summary if the selected alert matches
      if (selectedEvent && updated.alertId === selectedEvent.alertId) {
        fetchDeliveryDetails(selectedEvent.alertId);
      }
    });

    return () => socket.disconnect();
  }, [fetchEvents, selectedEvent, fetchDeliveryDetails]);

  const handleResendSingle = async (deliveryId) => {
    if (!selectedEvent) return;
    try {
      toast.loading('Resending alert...', { id: 'resend' });
      const { data } = await api.post(`/deliveries/${selectedEvent.alertId}/resend/${deliveryId}`);
      if (data && data.success) {
        toast.success('Alert sent successfully', { id: 'resend' });
        fetchDeliveryDetails(selectedEvent.alertId);
      }
    } catch (error) {
      toast.error('Resend failed', { id: 'resend' });
    }
  };

  const filteredDeliveries = React.useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    const digitQuery = query.replace(/\D/g, '');

    const isDelivered = (d) => d.notificationStatus === 'sent';
    const isFailed = (d) => d.notificationStatus === 'failed';
    const isPending = (d) => d.notificationStatus === 'pending' || d.notificationStatus === 'retrying';

    const getEffectiveStatus = (d) => {
      if (d.residentResponse?.status === 'help_requested' || d.guardAssessment?.status === 'help_requested') return 'help_requested';
      if (d.guardAssessment?.status === 'attacked') return 'attacked';
      if (d.residentResponse?.status === 'cannot_protect') return 'cannot_protect';
      if (d.guardAssessment?.status === 'protected' || d.residentResponse?.status === 'protected') return 'protected';
      return 'pending';
    };

    return deliveries.filter(d => {
      // 1. Filter logic
      let matchesFilter = true;
      if (statusFilter === 'sent') matchesFilter = isDelivered(d);
      else if (statusFilter === 'failed') matchesFilter = isFailed(d);
      else if (statusFilter === 'pending') matchesFilter = isPending(d);
      else if (statusFilter === 'protected') matchesFilter = getEffectiveStatus(d) === 'protected';
      else if (statusFilter === 'help_requested') matchesFilter = getEffectiveStatus(d) === 'help_requested';

      if (!matchesFilter) return false;

      // 2. Search logic
      if (!query) return true;

      const resident = d.residentId || {};
      const name = String(resident.name || d.residentName || '').toLowerCase();
      const phone = String(resident.phone || d.phone || '').toLowerCase();
      const telegramId = String(resident.telegramChatId || d.telegramChatId || '').toLowerCase();
      
      const phoneDigits = phone.replace(/\D/g, '');
      const telegramIdDigits = telegramId.replace(/\D/g, '');

      return name.includes(query) || 
             phone.includes(query) || 
             telegramId.includes(query) ||
             (digitQuery && (phoneDigits.includes(digitQuery) || telegramIdDigits.includes(digitQuery)));
    });
  }, [deliveries, searchTerm, statusFilter]);

  const getFilterCount = (id) => {
    if (id === 'all') return deliveries.length;
    
    const isDelivered = (d) => d.notificationStatus === 'sent';
    const isFailed = (d) => d.notificationStatus === 'failed';
    const isPending = (d) => d.notificationStatus === 'pending' || d.notificationStatus === 'retrying';

    const getEffectiveStatus = (d) => {
      if (d.residentResponse?.status === 'help_requested' || d.guardAssessment?.status === 'help_requested') return 'help_requested';
      if (d.guardAssessment?.status === 'attacked') return 'attacked';
      if (d.residentResponse?.status === 'cannot_protect') return 'cannot_protect';
      if (d.guardAssessment?.status === 'protected' || d.residentResponse?.status === 'protected') return 'protected';
      return 'pending';
    };

    if (id === 'sent') return deliveries.filter(isDelivered).length;
    if (id === 'failed') return deliveries.filter(isFailed).length;
    if (id === 'pending') return deliveries.filter(isPending).length;
    if (id === 'protected') return deliveries.filter(d => getEffectiveStatus(d) === 'protected').length;
    if (id === 'help_requested') return deliveries.filter(d => getEffectiveStatus(d) === 'help_requested').length;
    
    return 0;
  };

  const getEmptyMessage = () => {
    if (searchTerm) return "No residents match your search.";
    switch (statusFilter) {
      case 'sent': return "No delivered residents found.";
      case 'failed': return "No failed deliveries found.";
      case 'pending': return "No pending deliveries found.";
      case 'protected': return "No protected residents found.";
      case 'help_requested': return "No residents have requested help.";
      default: return "No residents were notified for this detection event.";
    }
  };

  return (
    <div className="space-y-[22px] pb-12 page-fade-in max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight">
             Lanka Beacon <span className="text-[#1768d1]">Delivery Tracking</span>
          </h1>
          <p className="text-[#64748b] text-[11px] font-[700] mt-1.5 uppercase tracking-widest">Real-time status of community notification alerts and safety responses</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchEvents}
            className="w-11 h-11 bg-white border border-[#dfe7f1] text-[#64748b] rounded-[5px] hover:bg-[#f4f8ff] hover:text-[#1768d1] transition-all shadow-sm flex items-center justify-center"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[14px]">
        {/* Left Panel: Detection Events */}
        <div className="lg:col-span-4">
          <div className="card flex flex-col max-h-[700px] border-[#dfe7f1]">
            <div className="px-6 py-[18px] border-b border-[#dfe7f1] bg-[#f8fafc] flex justify-between items-center shrink-0">
               <h2 className="text-[11px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em]">Detection Event Log</h2>
               <span className="text-[10px] font-[800] bg-[#1768d1] text-white px-2.5 py-1 rounded-[5px] shadow-sm">{events.length} EVENTS</span>
            </div>
            <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-[5px] mx-2 my-1"></div>)
              ) : events.length === 0 ? (
                <div className="py-24 text-center space-y-4 opacity-40">
                   <Activity size={32} className="mx-auto text-[#cbd5e1]" />
                   <p className="text-[#64748b] font-[800] uppercase text-[11px] tracking-widest">No detection events found</p>
                </div>
              ) : (
                events.map(event => (
                  <button
                    key={event.detectionId}
                    onClick={() => handleEventSelect(event)}
                    className={`w-full p-4 rounded-[5px] border transition-all text-left flex items-center gap-4 group ${
                      selectedEvent?.detectionId === event.detectionId
                        ? 'bg-[#eaf2ff] border-[#1768d1] text-[#1768d1]'
                        : 'bg-white border-transparent text-[#475569] hover:bg-[#f8fafc] hover:border-[#dfe7f1]'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-[5px] flex items-center justify-center shrink-0 transition-colors border-2 border-white shadow-sm ${
                      selectedEvent?.detectionId === event.detectionId
                        ? 'bg-[#1768d1] text-white'
                        : 'bg-[#f1f5f9] text-[#94a3b8] group-hover:bg-[#eaf2ff] group-hover:text-[#1768d1]'
                    }`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className={`text-[14px] font-[700] tracking-tight truncate ${
                          selectedEvent?.detectionId === event.detectionId ? 'text-[#0b2d63]' : 'text-[#0f172a]'
                        }`}>
                          {event.locationName || 'Unknown Location'}
                        </p>
                        <span className={`text-[10px] font-[800] px-2 py-0.5 rounded-[5px] border ${
                          selectedEvent?.detectionId === event.detectionId 
                            ? 'bg-white border-[#1768d1]/30 text-[#1768d1]'
                            : 'bg-[#f1f5f9] text-[#64748b] border-[#dbe4ef]'
                        }`}>
                          {event.summary?.sent || 0}/{event.summary?.total || 0}
                        </span>
                      </div>
                      <p className={`text-[10px] font-[700] uppercase tracking-widest mt-1 ${
                        selectedEvent?.detectionId === event.detectionId ? 'text-[#1768d1]/70' : 'text-[#94a3b8]'
                      }`}>
                        {safeFormat(event.detectedAt, 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Delivery Details */}
        <div className="lg:col-span-8 space-y-[14px]">
          {selectedEvent ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-[10px]">
                {[
                  { label: 'Residents', count: summary?.total || 0, color: 'text-[#0f172a]', icon: <User />, bg: 'bg-white', border: 'border-[#dfe7f1]' },
                  { label: 'Delivered', count: summary?.sent || 0, color: 'text-[#0e7a42]', icon: <CheckCircle />, bg: 'bg-[#edfcf4]', border: 'border-[#b7efcf]' },
                  { label: 'Failed', count: summary?.failed || 0, color: 'text-[#c81e1e]', icon: <XCircle />, bg: 'bg-[#fff1f1]', border: 'border-[#facaca]' },
                  { label: 'Protected', count: summary?.protected || 0, color: 'text-[#1768d1]', icon: <ShieldCheck />, bg: 'bg-[#eaf2ff]', border: 'border-[#1768d1]/20' },
                  { label: 'Help Req', count: summary?.helpRequests || 0, color: 'text-[#e02424]', icon: <AlertTriangle />, bg: 'bg-[#fff1f1]', border: 'border-[#facaca]' },
                ].map((stat, i) => (
                  <div key={i} className={`card p-4 flex flex-col gap-3 group transition-all border ${stat.bg} ${stat.border}`}>
                    <div className={`w-8 h-8 rounded-[5px] flex items-center justify-center border border-white bg-white/60 shadow-sm ${stat.color}`}>
                      {React.cloneElement(stat.icon, { size: 16, strokeWidth: 2.5 })}
                    </div>
                    <div>
                      <p className="text-[10px] font-[800] text-[#64748b] uppercase tracking-widest mb-1 leading-none">{stat.label}</p>
                      <h3 className={`text-[22px] font-[800] ${stat.color} tracking-tight leading-none`}>{stat.count}</h3>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div className="card flex flex-col min-h-[550px] border-[#dfe7f1]">
                <div className="px-6 py-[18px] border-b border-[#dfe7f1] flex flex-col xl:flex-row gap-4 justify-between items-center bg-[#f8fafc]">
                   <div className="relative flex-1 w-full max-w-md">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1]" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search by resident name, phone or Telegram ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-11 pl-11 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                      />
                   </div>
                   <div className="flex items-center gap-1 overflow-x-auto w-full xl:w-auto p-1 bg-[#f1f5f9] rounded-[5px]">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'sent', label: 'Delivered' },
                        { id: 'failed', label: 'Failed' },
                        { id: 'pending', label: 'Pending' },
                        { id: 'protected', label: 'Protected' },
                        { id: 'help_requested', label: 'Help Requested' }
                      ].map(filter => (
                        <button
                          key={filter.id}
                          onClick={() => setStatusFilter(filter.id)}
                          className={`h-9 px-4 rounded-[5px] font-[800] text-[10px] uppercase tracking-widest transition-all shrink-0 whitespace-nowrap ${
                            statusFilter === filter.id 
                              ? 'bg-white text-[#1768d1] shadow-sm' 
                              : 'text-[#64748b] hover:text-[#0f172a]'
                          }`}
                        >
                          {filter.label} ({getFilterCount(filter.id)})
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                  {isDetailsLoading ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 space-y-5 opacity-40">
                       <RefreshCw size={40} className="animate-spin text-[#1768d1]" />
                       <p className="text-[11px] font-[800] uppercase tracking-widest text-[#64748b]">Loading delivery data...</p>
                    </div>
                  ) : deliveries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 space-y-8">
                       <div className="w-20 h-20 bg-[#f8fafc] text-[#cbd5e1] rounded-[5px] flex items-center justify-center border border-[#dfe7f1] shadow-inner">
                          <ShieldAlert size={40} />
                       </div>
                       <div className="text-center space-y-3 px-8">
                          <p className="text-[16px] font-[800] text-[#0f172a] uppercase tracking-widest">No Deliveries Found</p>
                          <p className="text-[13px] text-[#64748b] font-[500] max-w-sm mx-auto leading-relaxed">No residents were notified for this detection event.</p>
                       </div>
                    </div>
                  ) : filteredDeliveries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 opacity-40">
                       <div className="w-16 h-16 rounded-[5px] border-2 border-dashed border-[#cbd5e1] flex items-center justify-center text-[#cbd5e1] mb-5">
                         <Search size={32} />
                       </div>
                       <p className="text-[11px] font-[800] uppercase tracking-widest text-[#64748b]">{getEmptyMessage()}</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#f8fafc] border-b border-[#dfe7f1]">
                          <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest">Resident</th>
                          <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest text-center">Distance</th>
                          <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest">Alert Status</th>
                          <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf1f6]">
                        {filteredDeliveries.map((d) => {
                          const formatDistance = (meters) => {
                            if (!Number.isFinite(meters)) return 'Unavailable';
                            if (meters < 1000) return `${Math.round(meters)} m`;
                            return `${((meters || 0) / 1000).toFixed(2)} km`;
                          };

                          return (
                          <tr key={d._id} className="hover:bg-[#f8fafc]/60 transition-colors group">
                            <td className="px-6 py-5">
                               <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-[5px] flex items-center justify-center shrink-0 transition-all border-2 border-white shadow-sm ${
                                    d.notificationStatus === 'sent' ? 'bg-[#edfcf4] text-[#0e7a42]' : 
                                    d.notificationStatus === 'failed' ? 'bg-[#fff1f1] text-[#c81e1e]' : 'bg-[#f1f5f9] text-[#64748b]'
                                  }`}>
                                    <User size={18} />
                                  </div>
                                  <div>
                                     <p className="font-[700] text-[#0f172a] text-[14px] tracking-tight leading-none group-hover:text-[#1768d1] transition-colors">{d.residentId?.name || d.residentName}</p>
                                     <p className="text-[10px] text-[#94a3b8] font-[700] uppercase tracking-wider mt-2">
                                       {d.residentId?.village || 'Unknown Village'}
                                     </p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                               <span className="text-[11px] font-mono font-[800] text-[#475569] bg-[#f1f5f9] px-2.5 py-1.5 rounded-[5px] border border-[#dfe7f1] shadow-sm">
                                 {formatDistance(d.distanceToDetectionMeters)}
                               </span>
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col gap-2">
                                  <div className={`badge w-fit px-3 font-[800] text-[10px] tracking-widest ${
                                    d.notificationStatus === 'sent' ? 'badge-success bg-[#edfcf4] text-[#0e7a42] border-[#b7efcf]' : 
                                    d.notificationStatus === 'failed' ? 'badge-danger bg-[#fff1f1] text-[#c81e1e] border-[#facaca]' : 'badge-warning bg-[#fff9e8] text-[#b76300] border-[#f8d68a]'
                                  } rounded-[5px]`}>
                                    {d.notificationStatus.toUpperCase()}
                                  </div>
                                </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                               {d.notificationStatus === 'sent' ? (
                                 <div className="text-right">
                                    <p className="text-[11px] font-[800] text-[#0e7a42] tracking-wider leading-none">
                                      {safeFormat(d.sentAt, 'HH:mm:ss')}
                                    </p>
                                    <p className="text-[9px] font-[700] text-[#94a3b8] uppercase mt-1.5">Delivered</p>
                                 </div>
                               ) : (
                                 <button 
                                   onClick={() => handleResendSingle(d._id)}
                                   disabled={d.notificationStatus === 'retrying'}
                                   className="h-9 px-4 bg-[#0f172a] text-white rounded-[5px] hover:bg-[#1768d1] transition-all shadow-md flex items-center justify-center gap-2 font-[800] text-[10px] uppercase tracking-widest ml-auto"
                                 >
                                   {d.notificationStatus === 'retrying' ? <RefreshCw className="animate-spin" size={12} /> : <RotateCcw size={12} />}
                                   Retry
                                 </button>
                               )}
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-[70vh] flex flex-col items-center justify-center space-y-8 px-6">
              <div className="w-28 h-28 bg-white rounded-[5px] border border-[#dfe7f1] flex items-center justify-center text-[#cbd5e1] shadow-xl group hover:border-[#1768d1] transition-all duration-700">
                 <ShieldAlert size={56} className="group-hover:text-[#2878e8] transition-colors duration-700" />
              </div>
              <div className="text-center space-y-3 opacity-40">
                 <h2 className="text-[18px] font-[800] text-[#0f172a] uppercase tracking-[0.2em]">Delivery Tracking</h2>
                 <p className="text-[#64748b] text-[12px] font-[600] max-w-sm mx-auto leading-relaxed uppercase tracking-widest">Select a detection event from the log to verify alert delivery and community response.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDashboard;
