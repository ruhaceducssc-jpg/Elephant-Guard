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
    <div className="space-y-[22px] pb-12 page-fade-in max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight">
            Lanka Beacon <span className="text-[#1768d1]">Alert History</span>
          </h1>
          <p className="text-[#64748b] text-[11px] font-[700] mt-1.5 uppercase tracking-widest">Comprehensive Command Center archive of historical detections</p>
        </div>
        <div className="flex items-center gap-3">
           <button className="h-11 px-6 bg-white border border-[#dfe7f1] text-[#334155] rounded-[5px] font-[700] text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#f8fafc] transition-all shadow-sm">
              <Download size={16} />
              Export Alert Dataset
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[14px]">
        {/* Filter & List Panel */}
        <div className="lg:col-span-8 space-y-[14px]">
           <div className="card p-3 flex flex-col md:flex-row gap-3 items-center justify-between border-[#dfe7f1]">
              <div className="relative flex-1 w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1]" size={18} />
                 <input 
                   type="text" 
                   placeholder="Search detection nodes..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="h-11 pl-12 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                 />
              </div>
              <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto p-1 bg-[#f1f5f9] rounded-[5px]">
                 {['all', 'active', 'cleared'].map(status => (
                   <button
                     key={status}
                     onClick={() => setStatusFilter(status)}
                     className={`h-9 px-5 rounded-[5px] font-[800] text-[10px] uppercase tracking-widest transition-all shrink-0 ${
                       statusFilter === status 
                         ? 'bg-white text-[#1768d1] shadow-sm' 
                         : 'text-[#64748b] hover:text-[#0f172a]'
                     }`}
                   >
                     {status}
                   </button>
                 ))}
              </div>
           </div>

           <div className="space-y-[10px]">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => <div key={i} className="h-[100px] card bg-slate-50 animate-pulse border-slate-100"></div>)
              ) : filteredAlerts.length === 0 ? (
                <div className="card py-24 text-center space-y-5 border-dashed border-[#dfe7f1] bg-[#f8fafc]/30">
                   <Activity size={40} className="text-[#cbd5e1] mx-auto" />
                   <p className="text-[#64748b] font-[800] uppercase tracking-widest text-[11px]">Historical records null for selected filter</p>
                </div>
              ) : (
                filteredAlerts.map(alert => (
                  <div 
                    key={alert.id || alert._id}
                    ref={el => scrollRefs.current[alert.id || alert._id] = el}
                    onClick={() => setSelectedAlert(alert)}
                    className={`card p-5 flex items-center justify-between cursor-pointer group transition-all border ${
                      (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id)
                        ? 'border-[#1768d1] bg-[#eaf2ff]/30 shadow-md'
                        : 'border-[#dfe7f1] bg-white hover:border-[#1768d1]/30 hover:bg-[#f8fafc]'
                    }`}
                  >
                    <div className="flex items-center gap-6">
                       <div className="w-20 h-20 bg-[#f1f5f9] rounded-[5px] overflow-hidden border border-[#dfe7f1] shrink-0 shadow-sm relative">
                          <img 
                            src={alert.image ? (alert.image.startsWith('http') ? alert.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${alert.image}`) : '/assets/images/elephant-fallback.jpg'} 
                            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" 
                            alt="Node" 
                          />
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-[#0f172a]/80 backdrop-blur-md rounded-[3px] text-[8px] font-[800] text-white uppercase tracking-wider">
                             {(alert.confidence * 100).toFixed(0)}% Match
                          </div>
                       </div>
                       <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                             <div className={`w-2 h-2 rounded-full ${alert.alertStatus === 'active' ? 'bg-[#ef3535] animate-pulse' : 'bg-[#18b866]'}`}></div>
                             <p className="text-[10px] font-[800] uppercase tracking-widest text-[#94a3b8]">System Identification Log</p>
                          </div>
                          <h3 className={`text-[17px] font-[800] tracking-tight truncate max-w-[320px] leading-tight ${
                             (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id) ? 'text-[#0b2d63]' : 'text-[#0f172a]'
                          }`}>
                             {alert.locationName || alert.areaName}
                          </h3>
                          <div className="flex items-center gap-5 mt-2.5">
                             <div className="flex items-center gap-2 text-[10px] font-[700] uppercase tracking-widest text-[#64748b]">
                                <Calendar size={12} className="text-[#cbd5e1]" /> {safeFormat(alert.detectedAt, 'MMM dd, yyyy')}
                             </div>
                             <div className="flex items-center gap-2 text-[10px] font-[700] uppercase tracking-widest text-[#64748b] border-l border-[#edf1f6] pl-5">
                                <Clock size={12} className="text-[#cbd5e1]" /> {safeFormat(alert.detectedAt, 'HH:mm')}
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-4">
                       <span className={`badge px-4 py-2 font-[800] text-[10px] tracking-widest ${
                         alert.alertStatus === 'active' ? 'badge-danger bg-[#fff1f1] text-[#c81e1e] border-[#facaca]' : 'badge-success bg-[#edfcf4] text-[#0e7a42] border-[#b7efcf]'
                       } rounded-[5px]`}>
                         {alert.alertStatus.toUpperCase()}
                       </span>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleDelete(alert.id || alert._id); }}
                         className="w-10 h-10 flex items-center justify-center text-[#cbd5e1] hover:text-[#e02424] hover:bg-[#fff1f1] rounded-[5px] transition-all border border-transparent hover:border-[#facaca]"
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
        <div className="lg:col-span-4">
           {selectedAlert ? (
             <div className="card overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500 sticky top-[108px] border-[#dfe7f1] bg-white">
                <div className="bg-[#f8fafc] p-6 border-b border-[#dfe7f1] flex items-center justify-between">
                   <div>
                      <h2 className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] leading-none mb-1.5">Intelligence Matrix</h2>
                      <p className="text-[15px] font-[800] text-[#0f172a] leading-none">LOG REF: #{selectedAlert.id?.slice(-8).toUpperCase() || selectedAlert._id?.slice(-8).toUpperCase()}</p>
                   </div>
                   <button onClick={() => setSelectedAlert(null)} className="w-9 h-9 flex items-center justify-center hover:bg-[#f1f5f9] text-[#64748b] rounded-[5px] transition-colors border border-[#dfe7f1]">
                      <XCircle size={18} />
                   </button>
                </div>
                
                <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
                   <div className="w-full aspect-[4/3] bg-[#07111f] rounded-[5px] overflow-hidden border border-[#dfe7f1] shadow-lg relative group">
                      <img 
                        src={selectedAlert.image ? (selectedAlert.image.startsWith('http') ? selectedAlert.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${selectedAlert.image}`) : '/assets/images/elephant-fallback.jpg'} 
                        className="w-full h-full object-contain" 
                        alt="Detection" 
                      />
                      <div className="absolute inset-0 bg-[#1768d1]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   </div>

                   <div className="space-y-1">
                      {[
                        { label: 'Neural Intelligence', value: 'AI COCO-SSD v4.2' },
                        { label: 'Deployment Source', value: selectedAlert.detectedBy?.name || 'Automated Node' },
                        { label: 'Patrol Boundary', value: selectedAlert.insidePatrolArea ? 'ZONE BREACHED' : 'EXTERIOR' },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between py-4 border-b border-[#edf1f6] last:border-0">
                           <p className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest">{row.label}</p>
                           <p className={`text-[12px] font-[800] ${row.value.includes('BREACHED') ? 'text-[#e02424]' : 'text-[#334155]'}`}>{row.value}</p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between py-5">
                         <p className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest">GPS Coordinates</p>
                         <p className="text-[11px] font-mono font-[800] text-[#1768d1] bg-[#eaf2ff] px-3 py-1.5 rounded-[5px] border border-[#1768d1]/20">
                            {selectedAlert.location?.coordinates ? `${selectedAlert.location.coordinates[1].toFixed(5)}, ${selectedAlert.location.coordinates[0].toFixed(5)}` : 'N/A'}
                         </p>
                      </div>
                   </div>

                   <button 
                     onClick={() => navigate(`/dashboard/map/${selectedAlert.id || selectedAlert._id}`)}
                     className="w-full h-14 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[13px] uppercase tracking-[0.2em] shadow-xl shadow-[#1768d1]/10 hover:bg-[#0f56b3] transition-all flex items-center justify-center gap-3"
                   >
                      <ExternalLink size={18} />
                      Open Tactical View
                   </button>
                </div>
             </div>
           ) : (
             <div className="card py-32 text-center border-dashed border-[#dfe7f1] bg-[#f8fafc]/50 space-y-6 px-10">
                <div className="w-20 h-20 bg-white rounded-[5px] flex items-center justify-center mx-auto text-[#cbd5e1] border border-[#dfe7f1] shadow-sm">
                   <AlertCircle size={40} />
                </div>
                <div className="space-y-2">
                   <h3 className="text-[13px] font-[800] text-[#0f172a] uppercase tracking-widest">Awaiting Tactical Selection</h3>
                   <p className="text-[11.5px] text-[#64748b] font-[500] leading-relaxed uppercase tracking-wider">Select a historical record from the log to initialize telemetry readout</p>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default AlertHistory;