import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, MapPin, Shield, Trash2, ExternalLink, Filter, CheckCircle, Clock, AlertCircle, XCircle, FileText, ChevronRight, BarChart3, Download, User } from 'lucide-react';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

const AlertHistory = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    acknowledged: 0,
    resolved: 0
  });

  // Safety date formatter
  const safeFormat = (date, formatStr) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : '--:--';
  };

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      
      const { data } = await api.get('/alerts', { params });
      const allAlerts = Array.isArray(data) ? data : [];
      setAlerts(allAlerts);
      
      // Calculate stats
      const newStats = allAlerts.reduce((acc, curr) => {
        acc.total++;
        if (acc[curr.alertStatus] !== undefined) {
          acc[curr.alertStatus]++;
        }
        return acc;
      }, { total: 0, new: 0, acknowledged: 0, resolved: 0, dismissed: 0 });
      setStats(newStats);
    } catch (error) {
      toast.error('Failed to sync alert database');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotifications = async (alertId) => {
    if (!alertId) return;
    setIsNotificationsLoading(true);
    try {
      const { data } = await api.get(`/alerts/${alertId}/notifications`);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch notification report');
      setNotifications([]);
    } finally {
      setIsNotificationsLoading(false);
    }
  };

  const handleAlertClick = (alert) => {
    setSelectedAlert(alert);
    setIsDrawerOpen(true);
    fetchNotifications(alert.id || alert._id);
  };

  useEffect(() => {
    fetchAlerts();

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    
    socket.on('new-elephant-alert', (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      toast.success('New Detection Inbound', { icon: '🐘' });
    });

    socket.on('alert-updated', (updatedAlert) => {
      setAlerts(prev => prev.map(a => (a.id || a._id) === (updatedAlert.id || updatedAlert._id) ? updatedAlert : a));
      if (selectedAlert && (selectedAlert.id || selectedAlert._id) === (updatedAlert.id || updatedAlert._id)) {
        setSelectedAlert(updatedAlert);
      }
    });

    return () => socket.disconnect();
  }, [statusFilter]);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/alerts/${id}/status`, { status: newStatus });
      toast.success(`Alert ${newStatus}`);
    } catch (error) {
      toast.error('Status update failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Permanent removal of alert record?')) {
      try {
        await api.delete(`/alerts/${id}`);
        toast.success('Record purged');
        fetchAlerts();
        if ((selectedAlert?.id || selectedAlert?._id) === id) setIsDrawerOpen(false);
      } catch (error) {
        toast.error('Purge failed');
      }
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Location', 'Latitude', 'Longitude', 'Confidence', 'Status', 'Detected At'];
    const rows = alerts.map(a => [
      a.id || a._id, 
      a.locationName || a.location?.locationName, 
      a.latitude || a.location?.coordinates[1], 
      a.longitude || a.location?.coordinates[0], 
      `${((a.confidence || 0) * 100).toFixed(0)}%`, 
      a.alertStatus, 
      safeFormat(a.detectedAt, 'yyyy-MM-dd HH:mm:ss')
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Elephant_Alerts_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'bg-red-100 text-red-700 border-red-200';
      case 'acknowledged': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'dismissed': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'new': return <AlertCircle size={14} />;
      case 'acknowledged': return <Clock size={14} />;
      case 'resolved': return <CheckCircle size={14} />;
      case 'dismissed': return <XCircle size={14} />;
      default: return null;
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 min-h-screen bg-gray-50/50">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight uppercase">Alert <span className="text-primary-600">Commander</span></h1>
          <p className="text-gray-500 font-medium mt-1">Unified Command Center for Sri Lanka Elephant Detections</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Download size={18} /> Export Data
          </button>
          <div className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Data Stream Active
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Unprocessed', count: stats.new, color: 'text-red-600', bg: 'bg-red-50', icon: <AlertCircle /> },
          { label: 'Acknowledged', count: stats.acknowledged, color: 'text-amber-600', bg: 'bg-amber-50', icon: <Clock /> },
          { label: 'Resolved', count: stats.resolved, color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle /> },
          { label: 'Success Rate', count: `${((stats.resolved / (stats.total || 1)) * 100).toFixed(0)}%`, color: 'text-primary-600', bg: 'bg-primary-50', icon: <BarChart3 /> },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-300">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className={`text-3xl font-black ${stat.color}`}>{stat.count}</h3>
            </div>
            <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
              {React.cloneElement(stat.icon, { size: 28 })}
            </div>
          </div>
        ))}
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col xl:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by location, officer, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchAlerts()}
            className="w-full pl-14 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-medium text-gray-700"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          {['all', 'new', 'acknowledged', 'resolved', 'dismissed'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
              {status}
            </button>
          ))}
          <div className="h-10 w-px bg-gray-200 mx-2 hidden xl:block"></div>
          <button 
            onClick={fetchAlerts}
            className="p-4 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="h-96 bg-gray-200 animate-pulse rounded-[3rem]"></div>
          ))
        ) : alerts.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-dashed border-gray-200">
            <Shield size={64} className="mx-auto text-gray-200 mb-6" />
            <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest">No Operational Alerts</h3>
          </div>
        ) : (
          alerts.map(alert => (
            <div 
              key={alert.id || alert._id} 
              onClick={() => handleAlertClick(alert)}
              className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden hover:shadow-2xl transition-all duration-500 group cursor-pointer relative"
            >
              <div className="relative h-56">
                <img 
                  src={alert.image ? `http://localhost:5000/uploads/${alert.image}` : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&q=80&w=600'} 
                  alt="Detection" 
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                
                <div className={`absolute top-6 left-6 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border backdrop-blur-md flex items-center gap-2 ${getStatusColor(alert.alertStatus)}`}>
                  {getStatusIcon(alert.alertStatus)}
                  {alert.alertStatus}
                </div>
                
                <div className="absolute bottom-6 left-6 right-6">
                   <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.3em] mb-1">Satellite Verified</p>
                   <h3 className="text-xl font-black text-white truncate uppercase">{alert.locationName || alert.location?.locationName}</h3>
                </div>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
                        <BarChart3 size={18} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase">Confidence</p>
                        <p className="font-bold text-gray-900">{((alert.confidence || 0) * 100).toFixed(0)}% Match</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black text-gray-400 uppercase">Timestamp</p>
                      <p className="font-bold text-gray-900">{safeFormat(alert.detectedAt, 'HH:mm')}</p>
                   </div>
                </div>

                <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                     <MapPin size={14} />
                     {(alert.latitude || alert.location?.coordinates[1] || 0).toFixed(4)}, {(alert.longitude || alert.location?.coordinates[0] || 0).toFixed(4)}
                   </div>
                   <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-primary-600 group-hover:text-white transition-all">
                     <ChevronRight size={20} />
                   </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Drawer */}
      {isDrawerOpen && selectedAlert && (
        <div className="fixed inset-0 z-[2000] flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-500">
             <div className="relative h-[400px]">
                <img 
                  src={selectedAlert.image ? `http://localhost:5000/uploads/${selectedAlert.image}` : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&q=80&w=800'} 
                  className="w-full h-full object-cover" 
                  alt="Evidence" 
                />
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="absolute top-8 left-8 p-4 bg-white/20 backdrop-blur-xl text-white rounded-2xl hover:bg-white/40 transition-all"
                >
                  <XCircle size={24} />
                </button>
             </div>

             <div className="p-10 space-y-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{selectedAlert.locationName || selectedAlert.location?.locationName}</h2>
                    <p className="text-gray-500 font-medium mt-1 flex items-center gap-2">
                      <Calendar size={18} /> {safeFormat(selectedAlert.detectedAt, 'PPPP p')}
                    </p>
                  </div>
                  <div className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border ${getStatusColor(selectedAlert.alertStatus)}`}>
                    {selectedAlert.alertStatus}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Detection Source</p>
                      <p className="font-bold text-gray-800 flex items-center gap-2">
                        <Shield size={16} className="text-primary-600" />
                        {selectedAlert.detectedBy?.name || 'Automated AI'}
                      </p>
                   </div>
                   <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Confidence Level</p>
                      <p className="font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 size={16} className="text-primary-600" />
                        {((selectedAlert.confidence || 0) * 100).toFixed(2)}%
                      </p>
                   </div>
                </div>

                {/* Notification Delivery Report Section */}
                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Notification Delivery Report</h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-50 text-green-600 rounded text-[9px] font-black uppercase">
                        {notifications.filter(n => n.status === 'sent').length} Sent
                      </span>
                      <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-[9px] font-black uppercase">
                        {notifications.filter(n => n.status === 'failed').length} Failed
                      </span>
                    </div>
                  </div>

                  {isNotificationsLoading ? (
                    <div className="py-12 text-center bg-gray-50 rounded-[2rem] border border-gray-100 animate-pulse">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Compiling Resident Report...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-12 text-center bg-gray-50 rounded-[2rem] border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Residents Notified</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map(notification => (
                        <div key={notification._id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between group hover:bg-white transition-all">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              notification.status === 'sent' ? 'bg-green-100 text-green-600' : 
                              notification.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              <User size={18} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-sm uppercase tracking-tight">{notification.residentName}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                {((notification.distanceFromElephant || 0) / 1000).toFixed(2)} km Away • {notification.telegramChatId}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 justify-end ${
                              notification.status === 'sent' ? 'text-green-600' : 
                              notification.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                            }`}>
                              {notification.status === 'sent' ? <CheckCircle size={12} /> : 
                               notification.status === 'failed' ? <XCircle size={12} /> : <Clock size={12} />}
                              {notification.status}
                            </div>
                            {notification.errorMessage && (
                              <p className="text-[8px] text-red-400 font-bold max-w-[150px] truncate mt-1">
                                {notification.errorMessage}
                              </p>
                            )}
                            {notification.sentAt && (
                              <p className="text-[8px] text-gray-400 font-bold uppercase mt-1">
                                {safeFormat(notification.sentAt, 'HH:mm:ss')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-100">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Internal Notes</h4>
                  <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 min-h-[120px] text-gray-600 font-medium leading-relaxed">
                    {selectedAlert.notes || "No operational notes recorded for this alert."}
                  </div>
                </div>

                <div className="pt-10 border-t border-gray-100 space-y-6">
                   <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Operational Actions</h4>
                   <div className="flex flex-wrap gap-3">
                      <button 
                        onClick={() => handleUpdateStatus(selectedAlert.id || selectedAlert._id, 'acknowledged')}
                        className="px-6 py-4 bg-amber-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-200"
                      >
                        Acknowledge
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(selectedAlert.id || selectedAlert._id, 'resolved')}
                        className="px-6 py-4 bg-green-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-200"
                      >
                        Resolve
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(selectedAlert.id || selectedAlert._id, 'dismissed')}
                        className="px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                      >
                        Dismiss
                      </button>
                      <div className="flex-1"></div>
                      <button 
                        onClick={() => handleDelete(selectedAlert.id || selectedAlert._id)}
                        className="p-4 text-red-600 hover:bg-red-50 rounded-2xl transition-colors"
                      >
                        <Trash2 size={24} />
                      </button>
                   </div>
                   
                   <button 
                    onClick={() => navigate(`/dashboard/map/${selectedAlert.id || selectedAlert._id}`)}
                    className="w-full flex items-center justify-center gap-3 py-5 bg-gray-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl"
                   >
                     <MapPin size={20} /> View on Internal Map
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertHistory;
