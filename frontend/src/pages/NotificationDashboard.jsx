import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, CheckCircle, XCircle, Clock, User, 
  ShieldAlert, BarChart3, Send, RotateCcw, Activity, Zap, 
  RefreshCw, Info, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

const NotificationDashboard = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [summary, setSummary] = useState({ total: 0, sent: 0, failed: 0, pending: 0, notSent: 0 });
  
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
        setSummary(data.summary || { total: 0, sent: 0, failed: 0, pending: 0, notSent: 0 });
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
    fetchDeliveryDetails(event.alertId);
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
      toast.error('Failed to sync tracking data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEvent, handleEventSelect]);

  useEffect(() => {
    fetchEvents();

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const guardId = userData.id || userData._id;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    
    if (guardId) {
      socket.emit('join', guardId);
    }

    socket.on('new-elephant-alert', () => {
      fetchEvents();
      toast('Operational update: New tracking event', { icon: '📡' });
    });

    socket.on('delivery-updated', (updated) => {
      setDeliveries(prev => {
        const index = prev.findIndex(d => d._id === updated._id);
        if (index !== -1) {
           const newDeliveries = [...prev];
           newDeliveries[index] = updated;
           return newDeliveries;
        }
        return prev;
      });
    });

    return () => socket.disconnect();
  }, [fetchEvents]);

  const handleGenerateMissing = async () => {
    if (!selectedEvent) return;
    setIsProcessing(true);
    try {
      toast.loading('Generating operational records...', { id: 'gen' });
      const { data } = await api.post(`/deliveries/${selectedEvent.alertId}/generate`);
      if (data && data.success) {
        toast.success(data.message || 'Records initialized', { id: 'gen' });
        fetchDeliveryDetails(selectedEvent.alertId);
        fetchEvents(); 
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Generation failed', { id: 'gen' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResendSingle = async (deliveryId) => {
    if (!selectedEvent) return;
    try {
      toast.loading('Initiating retransmission...', { id: 'resend' });
      const { data } = await api.post(`/deliveries/${selectedEvent.alertId}/resend/${deliveryId}`);
      if (data && data.success) {
        toast.success('Notification dispatched', { id: 'resend' });
        fetchDeliveryDetails(selectedEvent.alertId);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Resend failed', { id: 'resend' });
    }
  };

  const handleResendAllFailed = async () => {
    if (!selectedEvent) return;
    if (!window.confirm('Attempt retransmission for all failed and unsent recipients?')) return;
    
    setIsProcessing(true);
    try {
      toast.loading('Broadcasting recovery signals...', { id: 'resend-all' });
      const { data } = await api.post(`/deliveries/${selectedEvent.alertId}/resend-failed`);
      if (data && data.success) {
        toast.success(`Processed ${data.processed || 0} recoveries`, { id: 'resend-all' });
        fetchDeliveryDetails(selectedEvent.alertId);
      }
    } catch (error) {
      toast.error('Bulk recovery failed', { id: 'resend-all' });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredDeliveries = deliveries.filter(d => {
    const s = searchTerm.toLowerCase();
    const nameMatch = String(d.residentName || '').toLowerCase().includes(s);
    const phoneMatch = String(d.phone || '').toLowerCase().includes(s);
    const idMatch = String(d.telegramChatId || '').toLowerCase().includes(s);
    
    let statusMatch = false;
    if (statusFilter === 'all') {
      statusMatch = true;
    } else if (statusFilter === 'pending') {
      statusMatch = d.status === 'pending' || d.status === 'retrying';
    } else {
      statusMatch = d.status === statusFilter;
    }
    
    return (nameMatch || phoneMatch || idMatch) && statusMatch;
  });

  return (
    <div className="space-y-[22px] pb-12 page-fade-in max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight">
             Lanka Beacon <span className="text-[#1768d1]">Delivery Tracking</span>
          </h1>
          <p className="text-[#64748b] text-[11px] font-[700] mt-1.5 uppercase tracking-widest">Real-time status of community notification relays and geofence verification</p>
        </div>
        <div className="flex items-center gap-3">
          {(summary?.failed > 0 || summary?.notSent > 0) && (
            <button 
              onClick={handleResendAllFailed}
              disabled={isProcessing}
              className="h-11 px-5 bg-[#e02424] text-white rounded-[5px] font-[700] text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#c81e1e] transition-all shadow-lg shadow-[#e02424]/10"
            >
              <RotateCcw size={14} className={isProcessing ? 'animate-spin' : ''} />
              Retry Failed Alerts ({summary.failed + summary.notSent})
            </button>
          )}
          <button 
            onClick={fetchEvents}
            className="w-11 h-11 bg-white border border-[#dfe7f1] text-[#64748b] rounded-[5px] hover:bg-[#f4f8ff] hover:text-[#1768d1] transition-all shadow-sm flex items-center justify-center"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[14px]">
        {/* Left Panel: Operational Events */}
        <div className="lg:col-span-4 space-y-[14px]">
          <div className="card flex flex-col max-h-[700px] border-[#dfe7f1]">
            <div className="px-6 py-[18px] border-b border-[#dfe7f1] bg-[#f8fafc] flex justify-between items-center shrink-0">
               <h2 className="text-[11px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em]">Operational Event Log</h2>
               <span className="text-[10px] font-[800] bg-[#1768d1] text-white px-2.5 py-1 rounded-[5px] shadow-sm">{events.length} LOGS</span>
            </div>
            <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-[5px] mx-2 my-1"></div>)
              ) : events.length === 0 ? (
                <div className="py-24 text-center space-y-4 opacity-40">
                   <Activity size={32} className="mx-auto text-[#cbd5e1]" />
                   <p className="text-[#64748b] font-[800] uppercase text-[11px] tracking-widest">No deployments detected</p>
                </div>
              ) : (
                events.map(event => (
                  <button
                    key={event.alertId}
                    onClick={() => handleEventSelect(event)}
                    className={`w-full p-4 rounded-[5px] border transition-all text-left flex items-center gap-4 group ${
                      selectedEvent?.alertId === event.alertId
                        ? 'bg-[#eaf2ff] border-[#1768d1] text-[#1768d1]'
                        : 'bg-white border-transparent text-[#475569] hover:bg-[#f8fafc] hover:border-[#dfe7f1]'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-[5px] flex items-center justify-center shrink-0 transition-colors border-2 border-white shadow-sm ${
                      selectedEvent?.alertId === event.alertId
                        ? 'bg-[#1768d1] text-white'
                        : 'bg-[#f1f5f9] text-[#94a3b8] group-hover:bg-[#eaf2ff] group-hover:text-[#1768d1]'
                    }`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className={`text-[14px] font-[700] tracking-tight truncate ${
                          selectedEvent?.alertId === event.alertId ? 'text-[#0b2d63]' : 'text-[#0f172a]'
                        }`}>
                          {event.locationName || 'Unknown Node'}
                        </p>
                        <span className={`text-[10px] font-[800] px-2 py-0.5 rounded-[5px] border ${
                          selectedEvent?.alertId === event.alertId 
                            ? 'bg-white border-[#1768d1]/30 text-[#1768d1]'
                            : (event.summary?.sent === event.summary?.total && event.summary?.total > 0)
                            ? 'bg-[#edfcf4] text-[#0e7a42] border-[#b7efcf]'
                            : (event.summary?.failed > 0 || event.summary?.notSent > 0)
                            ? 'bg-[#fff1f1] text-[#c81e1e] border-[#facaca]'
                            : 'bg-[#f1f5f9] text-[#64748b] border-[#dbe4ef]'
                        }`}>
                          {event.summary?.sent || 0}/{event.summary?.total || 0}
                        </span>
                      </div>
                      <p className={`text-[10px] font-[700] uppercase tracking-widest mt-1 ${
                        selectedEvent?.alertId === event.alertId ? 'text-[#1768d1]/70' : 'text-[#94a3b8]'
                      }`}>
                        {safeFormat(event.detectedAt, 'MMM dd, HH:mm')} Transmission
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedEvent && (
            <div className="card p-6 relative overflow-hidden group border-[#dfe7f1]">
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-11 h-11 bg-[#f4f8ff] rounded-[5px] flex items-center justify-center border border-[#eaf2ff]">
                     <ShieldAlert size={22} className="text-[#1768d1]" />
                   </div>
                   <h3 className="font-[800] text-[#0f172a] text-[13px] uppercase tracking-widest">Event Confidence</h3>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-[700] uppercase tracking-widest">
                      <span className="text-[#64748b]">Neural Match Score</span>
                      <span className="text-[#1768d1]">{(selectedEvent.confidence * 100).toFixed(1)}%</span>
                   </div>
                   <div className="w-full bg-[#f1f5f9] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1768d1] h-full rounded-full transition-all duration-1000" style={{ width: `${selectedEvent.confidence * 100}%` }}></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-[700] text-[#94a3b8] uppercase tracking-widest">Protocol Matrix</p>
                        <p className="text-[11px] font-[800] text-[#334155] uppercase">Alpha Secure</p>
                      </div>
                      <div className="space-y-1.5 text-right">
                        <p className="text-[9px] font-[700] text-[#94a3b8] uppercase tracking-widest">Sync Status</p>
                        <p className="text-[11px] font-[800] text-[#119c55] uppercase tracking-tighter">Verified Link</p>
                      </div>
                   </div>
                </div>
              </div>
              <BarChart3 className="absolute -right-6 -bottom-6 text-[#1768d1] transition-all duration-1000 group-hover:scale-110 opacity-[0.03]" size={140} />
            </div>
          )}
        </div>

        {/* Right Panel: Delivery Details */}
        <div className="lg:col-span-8 space-y-[14px]">
          {selectedEvent ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-[10px]">
                {[
                  { label: 'Total Nodes', count: summary?.total || 0, color: 'text-[#0f172a]', icon: <User />, bg: 'bg-white', border: 'border-[#dfe7f1]' },
                  { label: 'Sent', count: summary?.sent || 0, color: 'text-[#0e7a42]', icon: <CheckCircle />, bg: 'bg-[#edfcf4]', border: 'border-[#b7efcf]' },
                  { label: 'Failed', count: summary?.failed || 0, color: 'text-[#c81e1e]', icon: <XCircle />, bg: 'bg-[#fff1f1]', border: 'border-[#facaca]' },
                  { label: 'Filtered', count: summary?.notSent || 0, color: 'text-[#64748b]', icon: <Info />, bg: 'bg-[#f8fafc]', border: 'border-[#dbe4ef]' },
                  { label: 'Queue', count: summary?.pending || 0, color: 'text-[#b76300]', icon: <Clock />, bg: 'bg-[#fff9e8]', border: 'border-[#f8d68a]' },
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
                        placeholder="Search community nodes by name or ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-11 pl-11 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                      />
                   </div>
                   <div className="flex items-center gap-1 overflow-x-auto w-full xl:w-auto p-1 bg-[#f1f5f9] rounded-[5px]">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'sent', label: 'Sent' },
                        { id: 'failed', label: 'Failed' },
                        { id: 'not_sent', label: 'Filtered' },
                        { id: 'pending', label: 'Queue' }
                      ].map(filter => (
                        <button
                          key={filter.id}
                          onClick={() => setStatusFilter(filter.id)}
                          className={`h-9 px-5 rounded-[5px] font-[800] text-[10px] uppercase tracking-widest transition-all shrink-0 ${
                            statusFilter === filter.id 
                              ? 'bg-white text-[#1768d1] shadow-sm' 
                              : 'text-[#64748b] hover:text-[#0f172a]'
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                  {isDetailsLoading ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 space-y-5 opacity-40">
                       <RefreshCw size={40} className="animate-spin text-[#1768d1]" />
                       <p className="text-[11px] font-[800] uppercase tracking-widest text-[#64748b]">Establishing Secure Relay Link...</p>
                    </div>
                  ) : deliveries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 space-y-8">
                       <div className="w-20 h-20 bg-[#f8fafc] text-[#cbd5e1] rounded-[5px] flex items-center justify-center border border-[#dfe7f1] shadow-inner">
                          <ShieldAlert size={40} />
                       </div>
                       <div className="text-center space-y-3 px-8">
                          <p className="text-[16px] font-[800] text-[#0f172a] uppercase tracking-widest">No Operational Footprint</p>
                          <p className="text-[13px] text-[#64748b] font-[500] max-w-sm mx-auto leading-relaxed">System protocols indicate no community nodes were active within the geofence perimeter for this specific tactical event.</p>
                       </div>
                       <button 
                         onClick={handleGenerateMissing}
                         disabled={isProcessing}
                         className="h-12 px-8 bg-[#1768d1] text-white rounded-[5px] shadow-xl shadow-[#1768d1]/10 font-[800] text-[12px] uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-[#0f56b3] transition-all"
                       >
                         {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                         Initialize Tracking Nodes
                       </button>
                    </div>
                  ) : filteredDeliveries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 opacity-40">
                       <div className="w-16 h-16 rounded-[5px] border-2 border-dashed border-[#cbd5e1] flex items-center justify-center text-[#cbd5e1] mb-5">
                         <Search size={32} />
                       </div>
                       <p className="text-[11px] font-[800] uppercase tracking-widest text-[#64748b]">Search query returned null</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#f8fafc] border-b border-[#dfe7f1]">
                          <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest">Community Node</th>
                          <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest text-center">Telemetry Range</th>
                          <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest">Transmission Status</th>
                          <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest text-right">Relay Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf1f6]">
                        {filteredDeliveries.map((d) => (
                          <tr key={d._id} className="hover:bg-[#f8fafc]/60 transition-colors group">
                            <td className="px-6 py-5">
                               <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-[5px] flex items-center justify-center shrink-0 transition-all border-2 border-white shadow-sm ${
                                    d.status === 'sent' ? 'bg-[#edfcf4] text-[#0e7a42]' : 
                                    (d.status === 'failed' || d.status === 'not_sent') ? 'bg-[#fff1f1] text-[#c81e1e]' : 'bg-[#fff9e8] text-[#b76300]'
                                  }`}>
                                    <User size={18} />
                                  </div>
                                  <div>
                                     <p className="font-[700] text-[#0f172a] text-[14px] tracking-tight leading-none group-hover:text-[#1768d1] transition-colors">{d.residentName}</p>
                                     <p className="text-[10px] text-[#94a3b8] font-[700] uppercase tracking-wider mt-2 flex items-center gap-1.5">
                                       <span className="w-1.5 h-1.5 bg-[#cbd5e1] rounded-full"></span>
                                       {d.telegramChatId === 'NOT_SET' ? 'LINK MISSING' : `CHAT REF: ${d.telegramChatId}`}
                                     </p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                               <span className="text-[11px] font-mono font-[800] text-[#475569] bg-[#f1f5f9] px-2.5 py-1.5 rounded-[5px] border border-[#dfe7f1] shadow-sm">
                                 {((d.distanceFromElephant || 0) / 1000).toFixed(2)} KM
                               </span>
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col gap-2">
                                  <div className={`badge w-fit px-3 font-[800] text-[10px] tracking-widest ${
                                    d.status === 'sent' ? 'badge-success bg-[#edfcf4] text-[#0e7a42] border-[#b7efcf]' : 
                                    (d.status === 'failed' || d.status === 'not_sent') ? 'badge-danger bg-[#fff1f1] text-[#c81e1e] border-[#facaca]' : 'badge-warning bg-[#fff9e8] text-[#b76300] border-[#f8d68a]'
                                  } rounded-[5px]`}>
                                    {d.status === 'not_sent' ? 'FILTERED' : d.status.toUpperCase()}
                                  </div>
                                  {d.reason && (
                                    <p className="text-[9px] font-[700] text-[#94a3b8] uppercase tracking-tight truncate max-w-[150px]" title={d.reason}>
                                      {(d.reason || '').replace(/_/g, ' ')}
                                    </p>
                                  )}
                                </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                               {d.status === 'sent' ? (
                                 <div className="text-right">
                                    <p className="text-[11px] font-[800] text-[#0e7a42] tracking-wider leading-none">
                                      {safeFormat(d.sentAt, 'HH:mm:ss')}
                                    </p>
                                    <p className="text-[9px] font-[700] text-[#94a3b8] uppercase tracking-[0.1em] mt-1.5">VERIFIED RELAY</p>
                                 </div>
                               ) : (
                                 <button 
                                   onClick={() => handleResendSingle(d._id)}
                                   disabled={d.status === 'retrying'}
                                   className="h-9 px-4 bg-[#0f172a] text-white rounded-[5px] hover:bg-[#1768d1] transition-all shadow-md flex items-center justify-center gap-2 font-[800] text-[10px] uppercase tracking-widest ml-auto active:scale-95 disabled:opacity-50"
                                 >
                                   {d.status === 'retrying' ? <RefreshCw className="animate-spin" size={12} /> : <RotateCcw size={12} />}
                                   {d.status === 'not_sent' ? 'SYNC' : 'RETRY'}
                                 </button>
                               )}
                            </td>
                          </tr>
                        ))}
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
                 <h2 className="text-[18px] font-[800] text-[#0f172a] uppercase tracking-[0.2em]">Operational Tracking Interface</h2>
                 <p className="text-[#64748b] text-[12px] font-[600] max-w-sm mx-auto leading-relaxed uppercase tracking-widest">Select an active operational deployment from the tactical log to verify community relay integrity and geofence telemetry.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDashboard;