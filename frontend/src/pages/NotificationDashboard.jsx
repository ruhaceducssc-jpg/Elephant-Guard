import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  MapPin, 
  AlertTriangle, 
  Info, 
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  BarChart3,
  Send,
  RotateCcw
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
      toast.error('Failed to fetch alert data');
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
      toast.error('Failed to load delivery records');
      setNotifications([]);
    } finally {
      setIsNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    
    socket.on('new-elephant-alert', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      toast('New Detection: Notification Tracking Active', { icon: '📢' });
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
  }, []); // Only on mount

  const handleAlertSelect = (alert) => {
    setSelectedAlert(alert);
    fetchNotifications(alert.id || alert._id);
  };

  const handleResendSingle = async (deliveryId) => {
    const alertId = selectedAlert?.id || selectedAlert?._id;
    if (!alertId) return;
    try {
      toast.loading('Retrying Telegram delivery...', { id: 'resend' });
      await api.post(`/alerts/${alertId}/notifications/${deliveryId}/resend`);
      toast.success('Retry attempt completed', { id: 'resend' });
      fetchNotifications(alertId); 
    } catch (error) {
      toast.error('Manual resend failed', { id: 'resend' });
    }
  };

  const handleResendAllFailed = async () => {
    const alertId = selectedAlert?.id || selectedAlert?._id;
    if (!alertId) return;
    if (!window.confirm('Confirm manual retry for ALL failed recipients?')) return;
    
    setIsResending(true);
    try {
      toast.loading('Executing bulk retry...', { id: 'resend-all' });
      await api.post(`/alerts/${alertId}/notifications/resend-failed`);
      toast.success('Bulk retry sequence completed', { id: 'resend-all' });
      fetchNotifications(alertId);
    } catch (error) {
      toast.error('Bulk retry failed', { id: 'resend-all' });
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
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">
            Notification <span className="text-primary-600">Commander</span>
          </h1>
          <p className="text-gray-500 font-medium mt-1">Real-time Resident Delivery Tracking System</p>
        </div>
        <div className="flex items-center gap-3">
          {stats.failed > 0 && (
            <button 
              onClick={handleResendAllFailed}
              disabled={isResending}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center gap-2 disabled:opacity-50"
            >
              <RotateCcw size={16} className={isResending ? 'animate-spin' : ''} />
              Resend All Failed ({stats.failed})
            </button>
          )}
          <button 
            onClick={() => selectedAlert && fetchNotifications(selectedAlert.id || selectedAlert._id)}
            className="p-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <RefreshCw size={20} className={isNotificationsLoading ? 'animate-spin' : ''} />
          </button>
          <div className="px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary-100 flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
            Tracking Active
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Panel: Alerts List */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Recent Alert Events</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-gray-100 animate-pulse rounded-2xl"></div>)
              ) : alerts.length === 0 ? (
                <p className="text-center py-10 text-gray-400 font-bold uppercase text-[10px]">No alerts recorded</p>
              ) : (
                alerts.map(alert => (
                  <button
                    key={alert.id || alert._id}
                    onClick={() => handleAlertSelect(alert)}
                    className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4 group ${
                      (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id)
                        ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-100'
                        : 'bg-white border-gray-100 text-gray-700 hover:border-primary-200 hover:bg-primary-50/30'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id)
                        ? 'bg-white/20 text-white'
                        : 'bg-primary-50 text-primary-600'
                    }`}>
                      <AlertTriangle size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black uppercase tracking-tight truncate ${
                        (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id) ? 'text-white' : 'text-gray-900'
                      }`}>
                        {alert.locationName || alert.location?.locationName}
                      </p>
                      <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
                        (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id) ? 'text-white/70' : 'text-gray-400'
                      }`}>
                        {safeFormat(alert.detectedAt, 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    <ChevronRight size={18} className={(selectedAlert?.id === alert.id || selectedAlert?._id === alert._id) ? 'text-white' : 'text-gray-300'} />
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedAlert && (
            <div className="bg-primary-700 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                     <ShieldAlert size={20} />
                   </div>
                   <h3 className="font-black uppercase tracking-widest text-sm">Alert Intelligence</h3>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-primary-200 font-bold uppercase tracking-widest">Confidence</span>
                      <span className="font-black">{(selectedAlert.confidence * 100).toFixed(2)}%</span>
                   </div>
                   <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-white h-full transition-all duration-1000" 
                        style={{ width: `${selectedAlert.confidence * 100}%` }}
                      ></div>
                   </div>
                   <div className="flex items-center gap-3 pt-2">
                      <MapPin size={14} className="text-primary-300" />
                      <span className="text-[10px] font-mono font-bold tracking-tight">
                        {selectedAlert.latitude?.toFixed(5) || selectedAlert.location?.coordinates[1].toFixed(5)}, {selectedAlert.longitude?.toFixed(5) || selectedAlert.location?.coordinates[0].toFixed(5)}
                      </span>
                   </div>
                </div>
              </div>
              <BarChart3 className="absolute -right-8 -bottom-8 text-white/10" size={160} />
            </div>
          )}
        </div>

        {/* Right Panel: Delivery Details */}
        <div className="lg:col-span-8 space-y-8">
          {selectedAlert ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total Recipients', count: stats.total, color: 'text-gray-900', bg: 'bg-white', icon: <User /> },
                  { label: 'Delivered', count: stats.sent, color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle /> },
                  { label: 'Failed', count: stats.failed, color: 'text-red-600', bg: 'bg-red-50', icon: <XCircle /> },
                  { label: 'Pending', count: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50', icon: <Clock /> },
                ].map((stat, i) => (
                  <div key={i} className={`${stat.bg} p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all`}>
                    <div className={`w-10 h-10 ${stat.color} flex items-center justify-center`}>
                      {React.cloneElement(stat.icon, { size: 24 })}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <h3 className={`text-3xl font-black ${stat.color}`}>{stat.count}</h3>
                    </div>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-6 border-b border-gray-50 flex flex-col xl:flex-row gap-4 justify-between items-center">
                   <div className="relative flex-1 w-full">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Filter by resident name..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-medium text-sm"
                      />
                   </div>
                   <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0">
                      {['all', 'sent', 'failed', 'pending'].map(status => (
                        <button
                          key={status}
                          onClick={() => setStatusFilter(status)}
                          className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all shrink-0 ${
                            statusFilter === status ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
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
                       <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                       <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Synchronizing Delivery Logs...</p>
                    </div>
                  ) : filteredNotifications.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-32 space-y-4">
                       <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                          <Info size={32} />
                       </div>
                       <div className="text-center">
                          <p className="text-sm font-bold text-gray-800">No matching records found</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Adjust filters or search terms</p>
                       </div>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Resident</th>
                          <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Distance</th>
                          <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status / Retries</th>
                          <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredNotifications.map((n) => (
                          <tr key={n._id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-8 py-5">
                               <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    n.status === 'sent' ? 'bg-green-100 text-green-600' : 
                                    n.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                  }`}>
                                    <User size={18} />
                                  </div>
                                  <div>
                                     <p className="font-bold text-gray-800 text-sm uppercase tracking-tight">{n.residentName}</p>
                                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{n.telegramChatId}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                               <span className="px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-600 uppercase tracking-tighter font-mono">
                                 {((n.distanceFromElephant || 0) / 1000).toFixed(2)} KM
                               </span>
                            </td>
                            <td className="px-6 py-5">
                               <div className="flex flex-col gap-1.5">
                                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${
                                    n.status === 'sent' ? 'bg-green-50 text-green-600' : 
                                    n.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {n.status === 'sent' ? <CheckCircle size={12} /> : 
                                     n.status === 'failed' ? <XCircle size={12} /> : <Clock size={12} />}
                                    {n.status}
                                  </div>
                                  {(n.retryCount > 0 || n.errorMessage) && (
                                    <div className="space-y-1">
                                      {n.retryCount > 0 && (
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                          <RotateCcw size={10} /> {n.retryCount} Retries Logged
                                        </p>
                                      )}
                                      {n.errorMessage && (
                                        <p className="text-[8px] text-red-400 font-bold max-w-[150px] truncate" title={n.errorMessage}>
                                          {n.errorMessage}
                                        </p>
                                      )}
                                    </div>
                                  )}
                               </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                               {n.status === 'failed' ? (
                                 <button 
                                   onClick={() => handleResendSingle(n._id)}
                                   className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ml-auto"
                                 >
                                   <Send size={14} /> Resend
                                 </button>
                               ) : n.status === 'sent' ? (
                                 <div className="text-right">
                                    <p className="text-xs font-bold text-gray-800">
                                      {safeFormat(n.sentAt, 'HH:mm:ss')}
                                    </p>
                                    <p className="text-[9px] text-gray-400 font-black uppercase">
                                      {n.sentAt ? safeFormat(n.sentAt, 'MMM dd') : 'Waiting'}
                                    </p>
                                 </div>
                               ) : (
                                 <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Processing</span>
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
            <div className="h-full flex flex-col items-center justify-center py-40 space-y-6">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-gray-100 shadow-xl border border-gray-50">
                 <ShieldAlert size={48} />
              </div>
              <div className="text-center">
                 <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest">Awaiting Command</h2>
                 <p className="text-gray-400 font-medium mt-2 max-w-sm mx-auto">
                    Select an alert from the command list on the left to view detailed notification delivery intelligence.
                 </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDashboard;
