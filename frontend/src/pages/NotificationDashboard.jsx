import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, Search, Filter, CheckCircle, XCircle, Clock, User, 
  MapPin, AlertTriangle, Info, RefreshCw, ChevronRight, 
  ShieldAlert, BarChart3, Send, RotateCcw, Activity, Zap
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
        // If nothing selected yet, select the first one
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
      // Use setDeliveries with function to avoid closure stale state issues
      setDeliveries(prev => {
        const index = prev.findIndex(d => d._id === updated._id);
        if (index !== -1) {
           const newDeliveries = [...prev];
           newDeliveries[index] = updated;
           return newDeliveries;
        }
        return prev;
      });
      // Optionally refetch summary if needed, but the delivery list update is key
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

  const getEmptyMessage = () => {
    if (searchTerm) return `No records matching "${searchTerm}"`;
    switch(statusFilter) {
      case 'sent': return 'No successful deliveries found for this event.';
      case 'failed': return 'No failed delivery records found.';
      case 'not_sent': return 'No unsent records (missing chat IDs) for this event.';
      case 'pending': return 'No pending or retrying transmissions found.';
      default: return 'No residents were within the geofence radius for this event.';
    }
  };

  return (
    <div className="space-y-10 pb-12 page-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
             <Send className="text-primary-600" size={28} />
             Delivery <span className="text-primary-600">Tracking</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Real-time confirmation of resident notification relays</p>
        </div>
        <div className="flex items-center gap-3">
          {(summary?.failed > 0 || summary?.notSent > 0) && (
            <button 
              onClick={handleResendAllFailed}
              disabled={isProcessing}
              className="btn btn-danger px-5 text-xs font-bold uppercase tracking-wider"
            >
              <RotateCcw size={14} className={isProcessing ? 'animate-spin' : ''} />
              Retry Failed ({summary.failed + summary.notSent})
            </button>
          )}
          <button 
            onClick={fetchEvents}
            className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all shadow-sm"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Panel: Operational Events */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-soft flex flex-col max-h-[700px] overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Tactical Log</h2>
               <span className="text-[9px] font-black bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{events.length} Events</span>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>)
              ) : events.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                   <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-200 border border-slate-100">
                      <Activity size={24} />
                   </div>
                   <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest">No active deployments</p>
                </div>
              ) : (
                events.map(event => (
                  <button
                    key={event.alertId}
                    onClick={() => handleEventSelect(event)}
                    className={`w-full p-4 rounded-xl border transition-all text-left flex items-center gap-4 group ${
                      selectedEvent?.alertId === event.alertId
                        ? 'bg-primary-50 border-primary-200 text-primary-900 shadow-sm'
                        : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      selectedEvent?.alertId === event.alertId
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-400 group-hover:bg-primary-100 group-hover:text-primary-600'
                    }`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className={`text-sm font-bold tracking-tight truncate ${
                          selectedEvent?.alertId === event.alertId ? 'text-primary-900' : 'text-slate-900'
                        }`}>
                          {event.locationName || 'Unknown'}
                        </p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          event.summary?.sent === event.summary?.total && event.summary?.total > 0
                            ? 'bg-success-100 text-success-700'
                            : (event.summary?.failed > 0 || event.summary?.notSent > 0)
                            ? 'bg-danger-100 text-danger-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {event.summary?.sent || 0}/{event.summary?.total || 0}
                        </span>
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
                        selectedEvent?.alertId === event.alertId ? 'text-primary-600/70' : 'text-slate-400'
                      }`}>
                        {safeFormat(event.detectedAt, 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedEvent && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-soft relative overflow-hidden group">
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100">
                     <ShieldAlert size={18} className="text-primary-600" />
                   </div>
                   <h3 className="font-bold text-slate-900 text-sm tracking-tight">Intelligence Specs</h3>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-bold uppercase tracking-widest">Neural Accuracy</span>
                      <span className="font-bold text-primary-600">{(selectedEvent.confidence * 100).toFixed(0)}%</span>
                   </div>
                   <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden p-0.5">
                      <div className="bg-primary-500 h-full rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${selectedEvent.confidence * 100}%` }}></div>
                   </div>
                   <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Deployment</p>
                        <p className="text-xs font-bold text-slate-700">LVL 4 Protocol</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Signal</p>
                        <p className="text-xs font-bold text-success-600">Encrypted</p>
                      </div>
                   </div>
                </div>
              </div>
              <BarChart3 className="absolute -right-6 -bottom-6 text-slate-100/50 group-hover:text-primary-50 transition-all duration-1000 group-hover:scale-110" size={140} />
            </div>
          )}
        </div>

        {/* Right Panel: Delivery Details */}
        <div className="lg:col-span-8 space-y-8">
          {selectedEvent ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 px-1">
                {[
                  { label: 'Total Relay', count: summary?.total || 0, color: 'text-slate-900', icon: <User /> },
                  { label: 'Successful', count: summary?.sent || 0, color: 'text-success-600', icon: <CheckCircle /> },
                  { label: 'Failed', count: summary?.failed || 0, color: 'text-danger-600', icon: <XCircle /> },
                  { label: 'Unsent', count: summary?.notSent || 0, color: 'text-rose-400', icon: <Info /> },
                  { label: 'Pending', count: summary?.pending || 0, color: 'text-warning-600', icon: <Clock /> },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-soft flex flex-col gap-3 group hover:border-primary-100 transition-all">
                    <div className={`w-8 h-8 ${stat.color} flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors`}>
                      {React.cloneElement(stat.icon, { size: 16 })}
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                      <h3 className={`text-xl font-bold ${stat.color} tracking-tight`}>{stat.count}</h3>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden flex flex-col min-h-[550px]">
                <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row gap-6 justify-between items-center bg-slate-50/50">
                   <div className="relative flex-1 w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="text" 
                        placeholder="Filter by name, phone or Telegram ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-11 bg-white"
                      />
                   </div>
                   <div className="flex items-center gap-1 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'sent', label: 'Sent' },
                        { id: 'failed', label: 'Failed' },
                        { id: 'not_sent', label: 'Not Sent' },
                        { id: 'pending', label: 'Pending' }
                      ].map(filter => (
                        <button
                          key={filter.id}
                          onClick={() => setStatusFilter(filter.id)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-widest transition-all shrink-0 ${
                            statusFilter === filter.id 
                              ? 'bg-primary-600 text-white shadow-md' 
                              : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                  {isDetailsLoading ? (
                    <div className="h-full flex flex-col items-center justify-center py-24 space-y-4">
                       <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing operational data...</p>
                    </div>
                  ) : deliveries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 space-y-6">
                       <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center border border-slate-100">
                          <ShieldAlert size={40} />
                       </div>
                       <div className="text-center space-y-1 px-8">
                          <p className="text-base font-bold text-slate-900">Zero Delivery Footprint</p>
                          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">No residents were within the geofence radius for this event, or tracking records have not been initialized.</p>
                       </div>
                       <button 
                         onClick={handleGenerateMissing}
                         disabled={isProcessing}
                         className="btn btn-primary px-8 py-3 rounded-2xl shadow-lg shadow-primary-200 font-black text-[10px] uppercase tracking-[0.2em]"
                       >
                         {isProcessing ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                         Initialize Records
                       </button>
                    </div>
                  ) : filteredDeliveries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 space-y-4">
                       <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center">
                          <Search size={32} />
                       </div>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{getEmptyMessage()}</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Resident Node</th>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-center">Telemetry</th>
                          <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Relay Status</th>
                          <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Operational Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredDeliveries.map((d) => (
                          <tr key={d._id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5">
                               <div className="flex items-center gap-4">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border ${
                                    d.status === 'sent' ? 'bg-success-50 text-success-600 border-success-100' : 
                                    (d.status === 'failed' || d.status === 'not_sent') ? 'bg-danger-50 text-danger-600 border-danger-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                  }`}>
                                    <User size={16} />
                                  </div>
                                  <div>
                                     <p className="font-bold text-slate-900 text-sm tracking-tight">{d.residentName}</p>
                                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                       {d.telegramChatId === 'NOT_SET' ? 'Bot Not Started' : `TG: ${d.telegramChatId}`}
                                     </p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                               <div className="inline-flex flex-col items-center">
                                  <span className="text-[10px] font-mono font-black text-slate-600">
                                    {((d.distanceFromElephant || 0) / 1000).toFixed(2)} km
                                  </span>
                                  <div className="w-8 h-0.5 bg-slate-100 mt-1"></div>
                               </div>
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col gap-1.5">
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider w-fit border ${
                                    d.status === 'sent' ? 'bg-success-50 text-success-700 border-success-100' : 
                                    (d.status === 'failed' || d.status === 'not_sent') ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                                  }`}>
                                    {d.status === 'sent' ? <CheckCircle size={10} /> : 
                                     (d.status === 'failed' || d.status === 'not_sent') ? <XCircle size={10} /> : <Clock size={10} />}
                                    {(d.status || '').replace('_', ' ')}
                                  </div>
                                  {d.errorMessage && d.status !== 'sent' && (
                                    <p className="text-[8px] text-rose-500 font-bold max-w-[140px] truncate ml-1" title={d.errorMessage}>
                                      LOG: {d.errorMessage}
                                    </p>
                                  )}
                                </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                               {d.status === 'sent' ? (
                                 <div className="text-right">
                                    <p className="text-xs font-black text-slate-700 tracking-tight">
                                      {safeFormat(d.sentAt, 'HH:mm:ss')}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      CONFIRMED
                                    </p>
                                 </div>
                               ) : (
                                 <button 
                                   onClick={() => handleResendSingle(d._id)}
                                   disabled={d.status === 'retrying'}
                                   className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-primary-600 transition-all shadow-md flex items-center gap-2 font-black text-[9px] uppercase tracking-widest ml-auto active:scale-95 disabled:opacity-50"
                                 >
                                   {d.status === 'retrying' ? <RefreshCw className="animate-spin" size={10} /> : <RotateCcw size={10} />}
                                   {d.status === 'not_sent' ? 'Transmit' : 'Retry'}
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
              <div className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center text-slate-100 shadow-soft border border-slate-100 group hover:border-primary-100 transition-all duration-700">
                 <ShieldAlert size={56} className="group-hover:text-primary-400 transition-colors duration-700" />
              </div>
              <div className="text-center space-y-2">
                 <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Operational Command</h2>
                 <p className="text-slate-400 text-sm font-medium max-w-xs mx-auto leading-relaxed">Select an active deployment from the tactical log to verify resident notification status.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDashboard;
