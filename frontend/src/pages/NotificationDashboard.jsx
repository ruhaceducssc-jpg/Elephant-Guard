import React, { useState, useEffect } from 'react';
import { 
  Bell, Search, Filter, CheckCircle, XCircle, Clock, User, 
  MapPin, AlertTriangle, Info, RefreshCw, ChevronRight, 
  ShieldAlert, BarChart3, Send, RotateCcw, Activity
} from 'lucide-react';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

const NotificationDashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Safety date formatter
  const safeFormat = (date, formatStr) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : '--:--';
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/alerts');
      if (Array.isArray(data)) {
        setAlerts(data);
        if (data.length > 0 && !selectedAlert) {
          setSelectedAlert(data[0]);
          fetchNotifications(data[0].id || data[0]._id);
        }
      }
    } catch (error) {
      toast.error('Failed to sync alert data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotifications = async (alertId) => {
    if (!alertId) return;
    setIsNotificationsLoading(true);
    try {
      const { data } = await api.get(`/alerts/${alertId}/notifications`);
      if (Array.isArray(data)) {
        setNotifications(data);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      toast.error('Failed to load delivery logs');
      setNotifications([]);
    } finally {
      setIsNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const { user } = JSON.parse(localStorage.getItem('user') || '{}');
    const guardId = user?.id || user?._id;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    
    if (guardId) {
      socket.emit('join', guardId);
    }

    socket.on('new-elephant-alert', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      toast('Operational update: New alert broadcasted', { icon: '📢' });
    });

    socket.on('alert-updated', (updatedAlert) => {
      setAlerts(prev => prev.map(a => (a.id || a._id) === (updatedAlert.id || updatedAlert._id) ? updatedAlert : a));
      if (selectedAlert && (selectedAlert.id || selectedAlert._id) === (updatedAlert.id || updatedAlert._id)) {
        setSelectedAlert(updatedAlert);
      }
    });

    socket.on('delivery-updated', (updatedDelivery) => {
      setNotifications(prev => prev.map(n => n._id === updatedDelivery._id ? updatedDelivery : n));
    });

    return () => socket.disconnect();
  }, []);

  const handleAlertSelect = (alert) => {
    setSelectedAlert(alert);
    fetchNotifications(alert.id || alert._id);
  };

  const handleResendSingle = async (deliveryId) => {
    const alertId = selectedAlert?.id || selectedAlert?._id;
    if (!alertId) return;
    try {
      toast.loading('Resending notification...', { id: 'resend' });
      await api.post(`/alerts/${alertId}/notifications/${deliveryId}/resend`);
      toast.success('Notification resent', { id: 'resend' });
      fetchNotifications(alertId); 
    } catch (error) {
      toast.error('Resend failed', { id: 'resend' });
    }
  };

  const handleResendAllFailed = async () => {
    const alertId = selectedAlert?.id || selectedAlert?._id;
    if (!alertId) return;
    if (!window.confirm('Resend all failed notifications for this alert?')) return;
    
    setIsResending(true);
    try {
      toast.loading('Resending all failed...', { id: 'resend-all' });
      await api.post(`/alerts/${alertId}/notifications/resend-failed`);
      toast.success('Retransmission sequence complete', { id: 'resend-all' });
      fetchNotifications(alertId);
    } catch (error) {
      toast.error('Bulk resend failed', { id: 'resend-all' });
    } finally {
      setIsResending(false);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = (n.residentName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: notifications.length || 0,
    sent: notifications.filter(n => n.status === 'sent').length || 0,
    failed: notifications.filter(n => n.status === 'failed').length || 0,
    pending: notifications.filter(n => n.status === 'pending').length || 0
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
          <p className="text-slate-500 text-sm font-medium mt-1">Monitor resident notification status and delivery reports</p>
        </div>
        <div className="flex items-center gap-3">
          {stats.failed > 0 && (
            <button 
              onClick={handleResendAllFailed}
              disabled={isResending}
              className="btn btn-danger px-5 text-xs font-bold uppercase tracking-wider"
            >
              <RotateCcw size={14} className={isResending ? 'animate-spin' : ''} />
              Retry Failed ({stats.failed})
            </button>
          )}
          <button 
            onClick={() => selectedAlert && fetchNotifications(selectedAlert.id || selectedAlert._id)}
            className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all shadow-sm"
          >
            <RefreshCw size={18} className={isNotificationsLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Panel: Alerts List */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-soft flex flex-col max-h-[650px] overflow-hidden">
            <div className="p-6 border-b border-slate-100">
               <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Recent Operational Events</h2>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-xl"></div>)
              ) : alerts.length === 0 ? (
                <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">No events recorded</p>
              ) : (
                alerts.map(alert => (
                  <button
                    key={alert.id || alert._id}
                    onClick={() => handleAlertSelect(alert)}
                    className={`w-full p-4 rounded-xl border transition-all text-left flex items-center gap-4 group ${
                      (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id)
                        ? 'bg-primary-50 border-primary-200 text-primary-900 shadow-sm'
                        : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id)
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-400 group-hover:bg-primary-100 group-hover:text-primary-600'
                    }`}>
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold tracking-tight truncate ${
                        (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id) ? 'text-primary-900' : 'text-slate-900'
                      }`}>
                        {alert.locationName || alert.location?.locationName}
                      </p>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
                        (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id) ? 'text-primary-600/70' : 'text-slate-400'
                      }`}>
                        {safeFormat(alert.detectedAt, 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    <ChevronRight size={14} className={(selectedAlert?.id === alert.id || selectedAlert?._id === alert._id) ? 'text-primary-600' : 'text-slate-300'} />
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedAlert && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-soft relative overflow-hidden group">
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100">
                     <ShieldAlert size={18} className="text-primary-600" />
                   </div>
                   <h3 className="font-bold text-slate-900 text-sm">Detection Intel</h3>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-bold uppercase tracking-widest">AI Confidence</span>
                      <span className="font-bold text-primary-600">{(selectedAlert.confidence * 100).toFixed(0)}%</span>
                   </div>
                   <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden p-0.5">
                      <div className="bg-primary-500 h-full rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${selectedAlert.confidence * 100}%` }}></div>
                   </div>
                   <div className="flex items-center gap-2 pt-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
                        {selectedAlert.locationName || 'Unknown Sector'}
                      </span>
                   </div>
                </div>
              </div>
              <BarChart3 className="absolute -right-6 -bottom-6 text-slate-100/50 group-hover:text-primary-50 transition-all duration-1000 group-hover:scale-110" size={140} />
            </div>
          )}
        </div>

        {/* Right Panel: Delivery Details */}
        <div className="lg:col-span-8 space-y-8">
          {selectedAlert ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 px-1">
                {[
                  { label: 'Total Relay', count: stats.total, color: 'text-slate-900', bg: 'bg-white', icon: <User /> },
                  { label: 'Successful', count: stats.sent, color: 'text-success-600', bg: 'bg-white', icon: <CheckCircle /> },
                  { label: 'Failed', count: stats.failed, color: 'text-danger-600', bg: 'bg-white', icon: <XCircle /> },
                  { label: 'Pending', count: stats.pending, color: 'text-warning-600', bg: 'bg-white', icon: <Clock /> },
                ].map((stat, i) => (
                  <div key={i} className={`${stat.bg} p-6 rounded-3xl border border-slate-200 shadow-soft flex flex-col gap-4 group hover:border-primary-100 transition-all`}>
                    <div className={`w-9 h-9 ${stat.color} flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors`}>
                      {React.cloneElement(stat.icon, { size: 18 })}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <h3 className={`text-2xl font-bold ${stat.color} tracking-tight`}>{stat.count}</h3>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row gap-6 justify-between items-center bg-slate-50/50">
                   <div className="relative flex-1 w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search residents..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-11 bg-white"
                      />
                   </div>
                   <div className="flex items-center gap-1.5 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0">
                      {['all', 'sent', 'failed', 'pending'].map(status => (
                        <button
                          key={status}
                          onClick={() => setStatusFilter(status)}
                          className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shrink-0 ${
                            statusFilter === status 
                              ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' 
                              : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                  {isNotificationsLoading ? (
                    <div className="h-full flex flex-col items-center justify-center py-20 space-y-4">
                       <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing logs...</p>
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 space-y-4">
                       <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center border border-slate-100">
                          <Info size={32} />
                       </div>
                       <div className="text-center">
                          <p className="text-sm font-bold text-slate-900">No records found</p>
                          <p className="text-xs text-slate-400 font-medium mt-1">Try adjusting your filters</p>
                       </div>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resident</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Distance</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                          <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Activity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredNotifications.map((n) => (
                          <tr key={n._id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5">
                               <div className="flex items-center gap-4">
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm border ${
                                    n.status === 'sent' ? 'bg-success-50 text-success-600 border-success-100' : 
                                    n.status === 'failed' ? 'bg-danger-50 text-danger-600 border-danger-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                  }`}>
                                    <User size={16} />
                                  </div>
                                  <div>
                                     <p className="font-bold text-slate-900 text-sm tracking-tight">{n.residentName}</p>
                                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">ID: {n.telegramChatId}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                               <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-mono font-bold text-slate-600">
                                 {((n.distanceFromElephant || 0) / 1000).toFixed(2)} km
                               </span>
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col gap-1.5">
                                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit border ${
                                    n.status === 'sent' ? 'badge-success border-success-100' : 
                                    n.status === 'failed' ? 'badge-danger border-danger-100' : 'badge-warning border-warning-100'
                                  }`}>
                                    {n.status === 'sent' ? <CheckCircle size={10} /> : 
                                     n.status === 'failed' ? <XCircle size={10} /> : <Clock size={10} />}
                                    {n.status}
                                  </div>
                                  {(n.retryCount > 0 || n.errorMessage) && (
                                    <div className="space-y-0.5 px-1">
                                      {n.retryCount > 0 && (
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                          <RotateCcw size={8} /> {n.retryCount} Retries
                                        </p>
                                      )}
                                      {n.errorMessage && (
                                        <p className="text-[8px] text-danger-500 font-bold max-w-[140px] truncate" title={n.errorMessage}>
                                          Error: {n.errorMessage}
                                        </p>
                                      )}
                                    </div>
                                  )}
                               </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                               {n.status === 'failed' ? (
                                 <button 
                                   onClick={() => handleResendSingle(n._id)}
                                   className="px-3.5 py-2 bg-slate-900 text-white rounded-lg hover:bg-primary-600 transition-all shadow-md flex items-center gap-2 font-bold text-[9px] uppercase tracking-widest ml-auto active:scale-95"
                                 >
                                   <Send size={10} /> Retry
                                 </button>
                               ) : n.status === 'sent' ? (
                                 <div className="text-right">
                                    <p className="text-xs font-bold text-slate-800 tracking-tight">
                                      {safeFormat(n.sentAt, 'HH:mm:ss')}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                      {n.sentAt ? safeFormat(n.sentAt, 'MMM dd') : '--'}
                                    </p>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2 justify-end text-amber-600 animate-pulse">
                                    <Activity size={14} />
                                    <span className="text-[9px] font-bold uppercase tracking-widest">Pending</span>
                                 </div>
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
            <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-slate-100 shadow-soft border border-slate-100 group hover:border-primary-100 transition-all duration-500">
                 <ShieldAlert size={48} className="group-hover:text-primary-400 transition-colors duration-500" />
              </div>
              <div className="text-center space-y-1">
                 <h2 className="text-xl font-bold text-slate-900 tracking-tight">Select an Event</h2>
                 <p className="text-slate-400 text-xs font-medium max-w-sm mx-auto">Select a detection event from the list to view detailed notification delivery status.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDashboard;
