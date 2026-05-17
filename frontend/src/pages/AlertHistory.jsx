import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Calendar, MapPin, Shield, Trash2, ExternalLink, Filter, CheckCircle, Clock, AlertCircle, XCircle, FileText, ChevronRight, Activity, Download } from 'lucide-react';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';

const AlertHistory = () => {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const scrollRefs = useRef({});

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/alerts');
      setAlerts(data);
      
      if (highlightId) {
        const target = data.find(a => (a.id || a._id) === highlightId);
        if (target) {
          setSelectedAlert(target);
          setTimeout(() => {
            const element = scrollRefs.current[highlightId];
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 500);
        }
      }
    } catch (error) {
      toast.error('Failed to sync history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this alert record? This action cannot be undone.')) {
      try {
        await api.delete(`/alerts/${id}`);
        toast.success('Record deleted');
        fetchAlerts();
        if (selectedAlert?.id === id || selectedAlert?._id === id) setSelectedAlert(null);
      } catch (error) {
        toast.error('Deletion failed');
      }
    }
  };

  const safeFormat = (date, formatStr) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : 'N/A';
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = (alert.locationName || alert.areaName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || alert.alertStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-10 pb-12 page-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
             <FileText className="text-primary-600" size={28} />
             Alert <span className="text-primary-600">History</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Comprehensive archive of all historical detections</p>
        </div>
        <div className="flex items-center gap-3">
           <button className="btn btn-secondary px-6">
              <Download size={18} />
              Export Data
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Filter & List Panel */}
        <div className="lg:col-span-8 space-y-6">
           <div className="bg-white p-4 flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl border border-slate-200 shadow-soft">
              <div className="relative flex-1 w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                   type="text" 
                   placeholder="Search locations..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="input pl-12"
                 />
              </div>
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                 {['all', 'active', 'cleared'].map(status => (
                   <button
                     key={status}
                     onClick={() => setStatusFilter(status)}
                     className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shrink-0 ${
                       statusFilter === status 
                         ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' 
                         : 'bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100'
                     }`}
                   >
                     {status}
                   </button>
                 ))}
              </div>
           </div>

           <div className="space-y-3">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-slate-100"></div>)
              ) : filteredAlerts.length === 0 ? (
                <div className="bg-white p-20 text-center space-y-4 rounded-3xl border border-slate-200 border-dashed">
                   <Activity size={40} className="text-slate-200 mx-auto" />
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No history found for current filters</p>
                </div>
              ) : (
                filteredAlerts.map(alert => (
                  <div 
                    key={alert.id || alert._id}
                    ref={el => scrollRefs.current[alert.id || alert._id] = el}
                    onClick={() => setSelectedAlert(alert)}
                    className={`bg-white p-4 rounded-2xl border flex items-center justify-between cursor-pointer group transition-all duration-300 ${
                      (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id)
                        ? 'border-primary-500 bg-primary-50/30'
                        : 'border-slate-100 hover:border-slate-300 shadow-soft'
                    }`}
                  >
                    <div className="flex items-center gap-5">
                       <div className="w-14 h-14 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 shrink-0 group-hover:scale-105 transition-transform">
                          <img 
                            src={alert.image ? (alert.image.startsWith('http') ? alert.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${alert.image}`) : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&q=80&w=200'} 
                            className="w-full h-full object-cover" 
                            alt="Node" 
                          />
                       </div>
                       <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-600 mb-0.5">
                             {(alert.confidence * 100).toFixed(0)}% Match
                          </p>
                          <h3 className="text-base font-bold text-slate-900 tracking-tight truncate max-w-[250px]">
                             {alert.locationName || alert.areaName}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 opacity-60">
                             <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                <Calendar size={12} /> {safeFormat(alert.detectedAt, 'MMM dd, yyyy')}
                             </div>
                             <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                <Clock size={12} /> {safeFormat(alert.detectedAt, 'HH:mm')}
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-3">
                       <span className={`badge ${
                         alert.alertStatus === 'active' ? 'badge-danger' : 'badge-success'
                       }`}>
                         {alert.alertStatus}
                       </span>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleDelete(alert.id || alert._id); }}
                         className="p-2.5 text-slate-300 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                       >
                          <Trash2 size={16} />
                       </button>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Detailed Intelligence Panel */}
        <div className="lg:col-span-4 h-fit sticky top-24">
           {selectedAlert ? (
             <div className="bg-white rounded-[2rem] border border-slate-200 shadow-premium overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-slate-50 p-6 border-b border-slate-100 relative">
                   <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-0.5">Alert Details</h2>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Historical Telemetry</p>
                   <button onClick={() => setSelectedAlert(null)} className="absolute top-6 right-6 p-2 hover:bg-slate-200 text-slate-400 rounded-xl transition-colors">
                      <XCircle size={18} />
                   </button>
                </div>
                
                <div className="p-8 space-y-8">
                   <div className="aspect-[4/3] bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 shadow-inner">
                      <img 
                        src={selectedAlert.image ? (selectedAlert.image.startsWith('http') ? selectedAlert.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${selectedAlert.image}`) : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&q=80&w=600'} 
                        className="w-full h-full object-cover" 
                        alt="Detection" 
                      />
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detection Method</p>
                         <p className="text-xs font-bold text-slate-700">AI Scanner v4.2</p>
                      </div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered By</p>
                         <p className="text-xs font-bold text-slate-700">{selectedAlert.detectedBy?.name || 'System'}</p>
                      </div>
                      <div className="flex items-center justify-between">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coordinates</p>
                         <p className="text-[10px] font-mono font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                            {selectedAlert.location?.coordinates ? `${selectedAlert.location.coordinates[1].toFixed(5)}, ${selectedAlert.location.coordinates[0].toFixed(5)}` : 'N/A'}
                         </p>
                      </div>
                   </div>

                   <button 
                     onClick={() => navigate(`/dashboard/map/${selectedAlert.id || selectedAlert._id}`)}
                     className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 flex items-center justify-center gap-2"
                   >
                      <ExternalLink size={16} />
                      View on Map
                   </button>
                </div>
             </div>
           ) : (
             <div className="bg-white p-12 text-center rounded-[2rem] border border-slate-200 border-dashed space-y-5">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-200 border border-slate-100">
                   <AlertCircle size={32} />
                </div>
                <div>
                   <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Selection Required</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 max-w-[150px] mx-auto">Select a history record to view detailed intelligence.</p>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default AlertHistory;
