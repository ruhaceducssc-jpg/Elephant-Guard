import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, Calendar, MapPin, Shield, Trash2, 
  ExternalLink, Filter, CheckCircle, Clock, AlertCircle, 
  XCircle, FileText, ChevronRight, Activity, Download,
  User, MessageSquare, ShieldCheck, ShieldAlert, RefreshCw, Send, Navigation
} from 'lucide-react';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

const getResidentMapId = (delivery) => {
  const resident = delivery?.resident || delivery?.residentId;

  if (typeof resident === 'string') return resident;

  return resident?._id?.toString()
    || delivery?.residentSnapshot?._id?.toString()
    || null;
};

const DetectionHistory = () => {
  const [detections, setDetections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [residents, setResidents] = useState([]);
  const [notificationSummary, setNotificationSummary] = useState({ linkedResidents: 0, sentSuccessfully: 0, helpRequests: 0 });
  const [safetyOutcome, setSafetyOutcome] = useState({ protected: 0, pending: 0, attackedOrCannotProtect: 0, requiredHelp: 0 });
  const [isResidentsLoading, setIsResidentsLoading] = useState(false);
  const [selectedDetectionIds, setSelectedDetectionIds] = useState([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exportScope, setExportScope] = useState('all');
  const [exportFilters, setExportFilters] = useState({
    startDate: '',
    endDate: '',
    location: ''
  });
  const [exportErrors, setExportErrors] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const scrollRefs = useRef({});

  const fetchDetections = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/detections', {
        params: { status: statusFilter, search: searchTerm }
      });
      setDetections(data);
      
      if (highlightId && !selectedDetection) {
        const target = data.find(d => d.id === highlightId);
        if (target) {
          setSelectedDetection(target);
          setTimeout(() => {
            const element = scrollRefs.current[highlightId];
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 500);
        }
      }
    } catch (error) {
      toast.error('Failed to sync detection history');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResidents = useCallback(async (detectionId) => {
    if (!detectionId) return;
    setIsResidentsLoading(true);
    try {
      const { data } = await api.get(`/detections/${detectionId}/residents`);
      if (data.success) {
        setResidents(data.linkedResidents || []);
        setNotificationSummary(data.notificationSummary);
        setSafetyOutcome(data.safetyOutcome);
      }
    } catch (error) {
      toast.error('Failed to load resident safety data');
    } finally {
      setIsResidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetections();
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    if (selectedDetection) {
      fetchResidents(selectedDetection.id);
    }
  }, [selectedDetection, fetchResidents]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const guardId = userData.id || userData._id;
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
    });

    if (guardId) {
      socket.emit('join', guardId);
    }
    
    socket.on('delivery-updated', (updated) => {
      // Refresh residents if the updated delivery belongs to current selection
      if (selectedDetection && updated.detectionId === selectedDetection.id) {
        fetchResidents(selectedDetection.id);
      }
    });

    socket.on('resident-safety-response', (data) => {
       if (selectedDetection && data.detectionId === selectedDetection.id) {
          fetchResidents(selectedDetection.id);
       }
    });

    socket.on('detection-status-updated', (data) => {
      setDetections(prev => prev.map(d => d.id === data.detectionId ? { ...d, status: data.status } : d));
      if (selectedDetection && selectedDetection.id === data.detectionId) {
        setSelectedDetection(prev => ({ 
          ...prev, 
          status: data.status, 
          clearedAt: data.clearedAt, 
          clearedBy: data.clearedBy, 
          clearReason: data.clearReason 
        }));
      }
    });

    socket.on('new-detection', () => {
      fetchDetections();
    });

    return () => socket.disconnect();
  }, [selectedDetection, fetchResidents]);

  const handleUpdateSafety = async (deliveryId, status, note = '') => {
    try {
      const { data } = await api.patch(`/deliveries/${deliveryId}/safety-status`, {
        safetyStatus: status,
        note: note
      });
      if (data.success) {
        toast.success(`Resident marked as ${status.replace(/_/g, ' ')}`);
        
        // Update local state for immediate feedback
        setResidents(prev => prev.map(r => r._id === deliveryId ? { ...r, ...data.delivery } : r));
        if (data.safetyOutcome) {
          setSafetyOutcome(data.safetyOutcome);
        }
      }
    } catch (error) {
      toast.error('Failed to update safety status');
    }
  };

  const handleAcknowledgeHelp = async (deliveryId) => {
    try {
      const { data } = await api.patch(`/deliveries/${deliveryId}/acknowledge-help`);
      if (data.success) {
        toast.success('Help request acknowledged');
        
        // Update local state for immediate feedback
        setResidents(prev => prev.map(r => r._id === deliveryId ? { ...r, ...data.delivery } : r));
        if (data.safetyOutcome) {
          setSafetyOutcome(data.safetyOutcome);
        }
      }
    } catch (error) {
      toast.error('Failed to acknowledge help');
    }
  };

  const handleManualClear = async (detectionId) => {
    const unresolvedCount = safetyOutcome.pending + safetyOutcome.attackedOrCannotProtect + safetyOutcome.requiredHelp;
    let reason = '';
    
    let confirmMsg = 'Mark this detection as cleared?\n\nUse this only after confirming that the elephant threat has ended and residents are safe.';
    
    if (unresolvedCount > 0) {
      confirmMsg += `\n\nWarning: There are ${unresolvedCount} unresolved resident outcomes.`;
      reason = window.prompt(`${confirmMsg}\n\nPlease provide a reason for manual clearing:`);
      if (reason === null) return; // Cancelled
      if (!reason.trim()) {
        return toast.error('A reason is required when unresolved residents exist.');
      }
    } else {
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      const { data } = await api.patch(`/detections/${detectionId}/clear`, { reason });
      toast.success('Detection marked as cleared');
      setDetections(prev => prev.map(d => d.id === detectionId ? { ...d, status: 'cleared' } : d));
      setSelectedDetection(prev => ({ ...prev, ...data }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to clear detection');
    }
  };

  const handleViewOnMap = (residentDelivery) => {
    const residentId = getResidentMapId(residentDelivery);

    if (!residentId) {
      return toast.error('Resident location is not available');
    }

    navigate(`/dashboard/map?residentId=${residentId}&detectionId=${selectedDetection.id}`);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this detection record and all associated alerts?')) {
      try {
        await api.delete(`/detections/${id}`);
        toast.success('Detection removed');
        setSelectedDetectionIds(prev => prev.filter(detectionId => detectionId !== id));
        fetchDetections();
        if (selectedDetection?.id === id) setSelectedDetection(null);
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

  const getSafetyBadge = (status) => {
    switch(status) {
      case 'protected':
        return <span className="px-2 py-1 bg-[#edfcf4] text-[#0e7a42] text-[9px] font-[800] uppercase rounded-[3px] border border-[#b7efcf]">Protected</span>;
      case 'attacked':
        return <span className="px-2 py-1 bg-[#fff1f1] text-[#ef4444] text-[9px] font-[800] uppercase rounded-[3px] border border-[#facaca]">Attacked</span>;
      case 'help_requested':
        return <span className="px-2 py-1 bg-[#fff1f1] text-[#f97316] text-[9px] font-[800] uppercase rounded-[3px] border border-[#f8d68a] animate-pulse">Help Requested</span>;
      default:
        return <span className="px-2 py-1 bg-[#fef3c7] text-[#92400e] text-[9px] font-[800] uppercase rounded-[3px] border border-[#fde68a]">Pending Confirmation</span>;
    }
  };

  const formatDistanceValue = (meters) => {
    if (!Number.isFinite(meters) || meters < 0) return 'Distance unavailable';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const toggleDetectionSelection = (detectionId) => {
    setSelectedDetectionIds(prev => (
      prev.includes(detectionId)
        ? prev.filter(id => id !== detectionId)
        : [...prev, detectionId]
    ));
  };

  const selectAllVisibleDetections = () => {
    setSelectedDetectionIds(prev => Array.from(new Set([
      ...prev,
      ...detections.map(detection => detection.id)
    ])));
  };

  const validateExport = () => {
    const errors = {};

    if (exportScope === 'selected' && selectedDetectionIds.length === 0) {
      errors.scope = 'Select at least one detection record.';
    }

    if (exportScope === 'current' && !selectedDetection?.id) {
      errors.scope = 'Open a detection record before using this range.';
    }

    if (exportScope === 'dateRange') {
      if (!exportFilters.startDate) errors.startDate = 'Start date is required.';
      if (!exportFilters.endDate) errors.endDate = 'End date is required.';
      if (
        exportFilters.startDate
        && exportFilters.endDate
        && exportFilters.startDate > exportFilters.endDate
      ) {
        errors.endDate = 'End date cannot be before start date.';
      }
    }

    setExportErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getExportErrorMessage = async (error) => {
    const responseData = error.response?.data;
    if (responseData instanceof Blob) {
      try {
        const parsed = JSON.parse(await responseData.text());
        return parsed.message;
      } catch {
        return null;
      }
    }

    return responseData?.message;
  };

  const handleExport = async () => {
    if (isExporting || !validateExport()) return;

    const params = {
      scope: exportScope,
      format: exportFormat
    };

    if (exportScope === 'selected') {
      params.detectionIds = selectedDetectionIds.join(',');
    } else if (exportScope === 'filtered') {
      params.status = statusFilter;
      params.search = searchTerm.trim();
    } else if (exportScope === 'current') {
      params.currentDetectionId = selectedDetection.id;
    } else if (exportScope === 'dateRange') {
      params.startDate = exportFilters.startDate;
      params.endDate = exportFilters.endDate;
      params.location = exportFilters.location.trim();
    }

    setIsExporting(true);
    try {
      const response = await api.get('/detections/export', {
        params,
        responseType: 'blob'
      });

      const disposition = response.headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fallbackDate = new Date().toISOString().slice(0, 10);
      const filename = filenameMatch?.[1]
        || `lankabeacon-detections-${fallbackDate}.${exportFormat}`;
      const downloadUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');

      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      toast.success('Detection data exported successfully.');
      setShowExportDialog(false);
    } catch (error) {
      const message = await getExportErrorMessage(error);
      toast.error(message || 'Failed to export detection data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-[22px] pb-12 page-fade-in max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight">
            Lanka Beacon <span className="text-[#1768d1]">Detection History</span>
          </h1>
          <p className="text-[#64748b] text-[11px] font-[700] mt-1.5 uppercase tracking-widest">Review elephant detections, linked alerts and resident safety outcomes.</p>
        </div>
        <div className="flex items-center gap-3">
           <button
             onClick={() => {
               setExportErrors({});
               setShowExportDialog(true);
             }}
             className="h-11 px-6 bg-white border border-[#dfe7f1] text-[#334155] rounded-[5px] font-[700] text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#f8fafc] transition-all shadow-sm"
           >
              <Download size={16} />
              Export Detection Data
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[14px]">
        {/* Left Side: Detection List */}
        <div className="lg:col-span-4 space-y-[14px]">
           <div className="card p-3 flex flex-col gap-3 border-[#dfe7f1]">
              <div className="relative flex-1 w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1]" size={18} />
                 <input 
                   type="text" 
                   placeholder="Search detections by location, date or resident..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="h-11 pl-12 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                 />
              </div>
              <div className="flex items-center gap-1 w-full bg-[#f1f5f9] rounded-[5px] p-1">
                 {['all', 'active', 'cleared'].map(status => (
                   <button
                     key={status}
                     onClick={() => setStatusFilter(status)}
                     className={`flex-1 h-9 rounded-[5px] font-[800] text-[10px] uppercase tracking-widest transition-all ${
                       statusFilter === status 
                         ? 'bg-white text-[#1768d1] shadow-sm' 
                         : 'text-[#64748b] hover:text-[#0f172a]'
                     }`}
                   >
                     {status}
                   </button>
                  ))}
               </div>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                  <span className="text-[10px] font-[800] text-[#64748b] uppercase tracking-widest">
                     {selectedDetectionIds.length} selected
                  </span>
                  <div className="flex items-center gap-2">
                     <button
                       type="button"
                       onClick={selectAllVisibleDetections}
                       disabled={detections.length === 0}
                       className="text-[9px] font-[800] text-[#1768d1] uppercase tracking-widest hover:text-[#0f56b3] disabled:text-[#cbd5e1] disabled:cursor-not-allowed"
                     >
                       Select all visible
                     </button>
                     <span className="text-[#cbd5e1]">·</span>
                     <button
                       type="button"
                       onClick={() => setSelectedDetectionIds([])}
                       disabled={selectedDetectionIds.length === 0}
                       className="text-[9px] font-[800] text-[#64748b] uppercase tracking-widest hover:text-[#0f172a] disabled:text-[#cbd5e1] disabled:cursor-not-allowed"
                     >
                       Clear selection
                     </button>
                  </div>
               </div>
            </div>

           <div className="space-y-[10px] max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar pr-1">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => <div key={i} className="h-[100px] card bg-slate-50 animate-pulse border-slate-100"></div>)
              ) : detections.length === 0 ? (
                <div className="card py-24 text-center space-y-5 border-dashed border-[#dfe7f1] bg-[#f8fafc]/30">
                   <Activity size={40} className="text-[#cbd5e1] mx-auto" />
                   <p className="text-[#64748b] font-[800] uppercase tracking-widest text-[11px]">No detections found</p>
                </div>
              ) : (
                detections.map(det => (
                  <div 
                    key={det.id}
                    ref={el => scrollRefs.current[det.id] = el}
                    onClick={() => setSelectedDetection(det)}
                    className={`card p-4 flex items-center justify-between cursor-pointer group transition-all border ${
                      selectedDetection?.id === det.id
                        ? 'border-[#1768d1] bg-[#eaf2ff]/30 shadow-md'
                        : 'border-[#dfe7f1] bg-white hover:border-[#1768d1]/30 hover:bg-[#f8fafc]'
                    }`}
                  >
                     <div className="flex items-center gap-4 min-w-0">
                       <input
                         type="checkbox"
                         checked={selectedDetectionIds.includes(det.id)}
                         onChange={() => toggleDetectionSelection(det.id)}
                         onClick={(event) => event.stopPropagation()}
                         aria-label={`Select detection ${det.locationName}`}
                         className="w-4 h-4 shrink-0 accent-[#1768d1] cursor-pointer"
                       />
                        <div className="w-16 h-16 bg-[#f1f5f9] rounded-[5px] overflow-hidden border border-[#dfe7f1] shrink-0 shadow-sm">
                          <img 
                            src={det.image ? (det.image.startsWith('http') ? det.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${det.image}`) : '/assets/images/elephant-fallback.jpg'} 
                            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" 
                            alt="Detection" 
                          />
                       </div>
                       <div className="min-w-0">
                          <h3 className={`text-[15px] font-[800] tracking-tight truncate leading-tight ${
                             selectedDetection?.id === det.id ? 'text-[#0b2d63]' : 'text-[#0f172a]'
                          }`}>
                             {det.locationName}
                          </h3>
                          <p className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest mt-1">
                             {safeFormat(det.detectedAt, 'MMM dd')} · {safeFormat(det.detectedAt, 'HH:mm')}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                             <span className={`w-2 h-2 rounded-full ${det.status === 'active' ? 'bg-[#ef3535] animate-pulse' : 'bg-[#18b866]'}`}></span>
                             <span className="text-[9px] font-[800] text-[#64748b] uppercase tracking-[0.1em]">
                                {det.status}
                             </span>
                          </div>
                       </div>
                    </div>
                    <ChevronRight size={16} className={`${selectedDetection?.id === det.id ? 'text-[#1768d1]' : 'text-[#cbd5e1]'}`} />
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Right Side: Detection Details & Residents */}
        <div className="lg:col-span-8">
           {selectedDetection ? (
             <div className="card overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500 border-[#dfe7f1] bg-white flex flex-col h-full min-h-[700px]">
                {/* Panel Header */}
                <div className="bg-[#f8fafc] p-6 border-b border-[#dfe7f1] flex items-center justify-between shrink-0">
                   <div>
                      <h2 className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] leading-none mb-1.5">Detection Details</h2>
                      <p className="text-[15px] font-[800] text-[#0f172a] leading-none uppercase tracking-tight">#{selectedDetection.id.slice(-8)} · {selectedDetection.locationName}</p>
                   </div>
                   <div className="flex items-center gap-3">
                      {selectedDetection.status === 'active' && (
                        <button 
                          onClick={() => handleManualClear(selectedDetection.id)}
                          className="h-10 px-4 bg-[#18b866] text-white rounded-[5px] font-[800] text-[10px] uppercase tracking-widest hover:bg-[#159e5d] transition-all flex items-center gap-2 border border-[#18b866]/20 shadow-sm"
                        >
                           <CheckCircle size={14} />
                           Mark as Cleared
                        </button>
                      )}
                      <button 
                        onClick={() => navigate(`/dashboard/map?detectionId=${selectedDetection.id}`)}
                        className="h-10 px-4 bg-[#eaf2ff] text-[#1768d1] rounded-[5px] font-[800] text-[10px] uppercase tracking-widest hover:bg-[#d0e1ff] transition-all flex items-center gap-2 border border-[#1768d1]/20"
                      >
                         <MapPin size={14} />
                         View on Map
                      </button>
                      <button onClick={() => setSelectedDetection(null)} className="w-10 h-10 flex items-center justify-center hover:bg-[#f1f5f9] text-[#64748b] rounded-[5px] transition-colors border border-[#dfe7f1]">
                         <XCircle size={20} />
                      </button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-stretch">
                      {/* Detection Info Card - Enlarged Yellow Area */}
                      <div className="lg:col-span-7 flex flex-col">
                         <div className="w-full h-full min-h-[300px] bg-[#07111f] rounded-[5px] overflow-hidden border border-[#dfe7f1] shadow-lg relative group flex items-center justify-center">
                            <img 
                              src={selectedDetection.image ? (selectedDetection.image.startsWith('http') ? selectedDetection.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${selectedDetection.image}`) : '/assets/images/elephant-fallback.jpg'} 
                              className="w-full h-full object-contain" 
                              alt="Elephant Detection" 
                            />
                            <div className={`badge absolute top-4 left-4 ${selectedDetection.status === 'active' ? 'bg-[#ef3535]/80' : 'bg-[#18b866]/80'} backdrop-blur-md text-white border-white/10 rounded-[4px] px-3 py-1.5 h-auto font-[800] text-[10px] uppercase tracking-widest`}>
                               {selectedDetection.status}
                            </div>
                         </div>
                      </div>

                      {/* Summary & Metadata - Enlarged Blue Area */}
                      <div className="lg:col-span-5 flex flex-col gap-6">
                         {selectedDetection.status === 'cleared' && (
                            <div className="p-5 bg-[#f0fdf4] border border-[#b7efcf] rounded-[5px] shadow-sm animate-in fade-in zoom-in duration-300">
                               <h3 className="text-[11px] font-[800] text-[#166534] uppercase tracking-widest border-b border-[#b7efcf] pb-3 mb-4 flex items-center gap-2">
                                  <ShieldCheck size={16} />
                                  Clearing Information
                               </h3>
                               <div className="space-y-3">
                                  <div className="flex justify-between text-[12px] font-[600]">
                                     <span className="text-[#166534]/70">Cleared At</span>
                                     <span className="text-[#166534]">{safeFormat(selectedDetection.clearedAt, 'PPpp')}</span>
                                  </div>
                                  <div className="flex justify-between text-[12px] font-[600]">
                                     <span className="text-[#166534]/70">Cleared By</span>
                                     <span className="text-[#166534] uppercase tracking-wider text-[10px]">{selectedDetection.clearedBy === 'automatic' ? 'Automatic Confirmation' : 'Guard Action'}</span>
                                  </div>
                                  {selectedDetection.clearReason && (
                                     <div className="pt-2 mt-2 border-t border-[#b7efcf]">
                                        <p className="text-[10px] font-[700] text-[#166534]/70 uppercase tracking-widest mb-1">Reason</p>
                                        <p className="text-[12px] font-[500] text-[#166534] leading-relaxed italic">"{selectedDetection.clearReason}"</p>
                                     </div>
                                  )}
                               </div>
                            </div>
                         )}
                         <div className="p-5 bg-white border border-[#dfe7f1] rounded-[5px] shadow-sm flex-1 flex flex-col">
                            <h3 className="text-[11px] font-[800] text-[#334155] uppercase tracking-widest border-b border-[#edf1f6] pb-3 mb-4">Notification Summary</h3>
                            <div className="space-y-4 flex-1">
                               <div className="flex justify-between items-center text-[13px] font-[700]">
                                  <span className="text-[#64748b]">Linked Residents</span>
                                  <span className="text-[#0f172a]">{notificationSummary.linkedResidents}</span>
                               </div>
                               <div className="flex justify-between items-center text-[13px] font-[700]">
                                  <span className="text-[#64748b]">Sent Successfully</span>
                                  <span className="text-[#119c55]">{notificationSummary.sentSuccessfully}</span>
                               </div>
                               <div className="flex justify-between items-center text-[13px] font-[700]">
                                  <span className="text-[#64748b]">Help Requests</span>
                                  <span className="text-[#e02424] font-[800]">{notificationSummary.helpRequests}</span>
                               </div>
                            </div>
                         </div>
                         
                         <div className="p-5 bg-[#0f172a] text-white rounded-[5px] shadow-xl flex-1 flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                               <div className="p-2 bg-white/10 rounded-[4px] border border-white/10 text-[#2878e8]">
                                  <ShieldCheck size={18} />
                                </div>
                               <p className="text-[11px] font-[800] uppercase tracking-widest">Safety Outcome</p>
                            </div>
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4 flex-1">
                               <div>
                                  <p className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest mb-1.5">Protected</p>
                                  <p className="text-[20px] font-[800] text-[#119c55]">{safetyOutcome.protected}</p>
                               </div>
                               <div>
                                  <p className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest mb-1.5">Pending</p>
                                  <p className="text-[20px] font-[800] text-[#fbbf24]">{safetyOutcome.pending}</p>
                               </div>
                               <div>
                                  <p className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest mb-1.5">Attacked / Cannot</p>
                                  <p className="text-[20px] font-[800] text-[#ef4444]">{safetyOutcome.attackedOrCannotProtect}</p>
                               </div>
                               <div>
                                  <p className="text-[10px] font-[700] text-[#94a3b8] uppercase tracking-widest mb-1.5">Required Help</p>
                                  <p className="text-[20px] font-[800] text-[#f97316]">{safetyOutcome.requiredHelp}</p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Linked Residents Table */}
                   <div className="space-y-6 mt-12">
                      <div className="flex items-center justify-between border-b border-[#edf1f6] pb-4">
                         <h3 className="text-[14px] font-[800] text-[#0f172a] uppercase tracking-widest flex items-center gap-2">
                            <User size={20} className="text-[#1768d1]" />
                            Linked Residents & Safety Outcomes
                         </h3>
                         <span className="text-[10px] font-[800] text-[#94a3b8] uppercase bg-[#f1f5f9] px-3 py-1.5 rounded-[5px] border border-[#dbe4ef]">
                            {residents.length} TOTAL
                         </span>
                      </div>

                      {isResidentsLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
                           <RefreshCw size={32} className="animate-spin text-[#1768d1]" />
                           <p className="text-[10px] font-[800] uppercase tracking-[0.2em]">Synchronizing safety data...</p>
                        </div>
                      ) : residents.length === 0 ? (
                        <div className="py-20 text-center bg-[#f8fafc]/50 rounded-[5px] border border-dashed border-[#dfe7f1] space-y-4">
                           <ShieldAlert size={40} className="mx-auto text-[#cbd5e1]" />
                           <p className="text-[11px] font-[700] text-[#64748b] uppercase tracking-widest">No eligible residents linked to this detection area</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                           {residents.map(delivery => {
                             const effectiveStatus = delivery.guardAssessment?.status || 'pending';
                             const residentMapId = getResidentMapId(delivery);

                             return (
                             <div key={delivery._id} className="p-6 border border-[#dfe7f1] bg-white rounded-[5px] hover:border-[#1768d1]/30 transition-all shadow-sm">
                                <div className="flex flex-col lg:flex-row gap-8">
                                   <div className="flex-1 space-y-6">
                                      <div className="flex items-center gap-4">
                                         <div className={`w-14 h-14 rounded-[5px] flex items-center justify-center border-2 border-white shadow-sm shrink-0 ${
                                           effectiveStatus === 'protected' ? 'bg-[#edfcf4] text-[#0e7a42]' :
                                           effectiveStatus === 'help_requested' || effectiveStatus === 'attacked' ? 'bg-[#fff1f1] text-[#c81e1e]' : 'bg-[#f8fafc] text-[#475569]'
                                         }`}>
                                            <User size={28} />
                                         </div>
                                         <div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                               <p className="text-[18px] font-[800] text-[#0f172a] tracking-tight leading-none">
                                                  {delivery.residentId?.name || 'Unknown Resident'}
                                               </p>
                                               {getSafetyBadge(effectiveStatus)}
                                            </div>
                                            <p className="text-[11px] font-[700] text-[#64748b] mt-2 uppercase tracking-widest">
                                               Resident Information Profile
                                            </p>
                                         </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                                         <div className="space-y-1">
                                            <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-widest">Phone Number</p>
                                            <p className="text-[13px] font-[700] text-[#334155]">{delivery.residentId?.phone || 'N/A'}</p>
                                         </div>
                                         <div className="space-y-1">
                                            <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-widest">Telegram Chat ID</p>
                                            <p className="text-[13px] font-[700] text-[#1768d1] font-mono break-all">{delivery.residentId?.telegramChatId || 'NOT LINKED'}</p>
                                         </div>
                                         <div className="space-y-1">
                                            <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-widest">Village / Registered Area</p>
                                            <p className="text-[13px] font-[700] text-[#334155]">{delivery.residentId?.village || 'Unknown'}</p>
                                         </div>
                                         <div className="space-y-1">
                                            <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-widest">Distance from Elephant</p>
                                            <p className="text-[13px] font-[800] text-[#ef4444]">{formatDistanceValue(delivery.distanceToDetectionMeters)}</p>
                                         </div>
                                         <div className="space-y-1">
                                            <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-widest">Resident Response</p>
                                            <p className="text-[11px] font-[800] text-[#1768d1] uppercase">{delivery.residentResponse?.status?.replace(/_/g, ' ') || 'Pending'}</p>
                                         </div>
                                         <div className="space-y-1">
                                            <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-widest">Guard Safety Assessment</p>
                                            <p className={`text-[11px] font-[800] uppercase ${effectiveStatus === 'attacked' ? 'text-[#ef4444]' : (effectiveStatus === 'protected' ? 'text-[#119c55]' : 'text-[#334155]')}`}>
                                               {effectiveStatus.replace(/_/g, ' ')}
                                            </p>
                                         </div>
                                      </div>
                                   </div>

                                   <div className="lg:w-[320px] shrink-0 space-y-4">
                                      <p className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] mb-3">Guard Actions</p>
                                      <div className="grid grid-cols-2 gap-2 w-full">
                                         <button 
                                            onClick={() => handleUpdateSafety(delivery._id, 'protected')}
                                            className={`h-[42px] rounded-[5px] font-[800] text-[10px] uppercase tracking-widest transition-all border ${
                                               effectiveStatus === 'protected'
                                               ? 'bg-[#119c55] text-white border-[#119c55]'
                                               : 'bg-white border-[#dfe7f1] text-[#64748b] hover:border-[#119c55] hover:text-[#119c55]'
                                            }`}
                                         >
                                            Protected
                                         </button>
                                         <button 
                                            onClick={() => {
                                               if (window.confirm('Confirm that this resident was affected by the elephant attack?')) {
                                                  handleUpdateSafety(delivery._id, 'attacked');
                                               }
                                            }}
                                            className={`h-[42px] rounded-[5px] font-[800] text-[10px] uppercase tracking-widest transition-all border ${
                                               effectiveStatus === 'attacked'
                                               ? 'bg-[#ef4444] text-white border-[#ef4444]'
                                               : 'bg-white border-[#dfe7f1] text-[#64748b] hover:border-[#ef4444] hover:text-[#ef4444]'
                                            }`}
                                         >
                                            Attacked
                                         </button>
                                         <button 
                                            onClick={() => handleUpdateSafety(delivery._id, 'help_requested')}
                                            className={`h-[42px] rounded-[5px] font-[800] text-[10px] uppercase tracking-widest transition-all border ${
                                               effectiveStatus === 'help_requested'
                                               ? 'bg-[#f97316] text-white border-[#f97316]'
                                               : 'bg-white border-[#dfe7f1] text-[#64748b] hover:border-[#f97316] hover:text-[#f97316]'
                                            }`}
                                         >
                                            Help Req
                                         </button>
                                         <button 
                                            onClick={() => handleViewOnMap(delivery)}
                                            disabled={!residentMapId}
                                            title={residentMapId ? 'View resident on Live Map' : 'Resident location is not available'}
                                            className="h-[42px] bg-white border border-[#dfe7f1] rounded-[5px] text-[#1768d1] font-[800] text-[10px] uppercase tracking-widest hover:bg-[#eaf2ff] hover:border-[#1768d1]/30 transition-all disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white disabled:hover:border-[#dfe7f1]"
                                         >
                                            View on Map
                                         </button>
                                      </div>
                                   </div>
                                </div>
                             </div>
                           )})}
                        </div>
                      )}
                   </div>
                </div>
                
                {/* Delete Panel footer */}
                <div className="p-4 bg-white border-t border-[#edf1f6] flex justify-end">
                   <button 
                     onClick={() => handleDelete(selectedDetection.id)}
                     className="h-10 px-4 text-[#cbd5e1] hover:text-[#e02424] hover:bg-[#fff1f1] rounded-[5px] transition-all flex items-center gap-2 font-[800] text-[10px] uppercase tracking-widest"
                   >
                      <Trash2 size={16} />
                      Remove Record
                   </button>
                </div>
             </div>
           ) : (
             <div className="card py-48 text-center border-dashed border-[#dfe7f1] bg-[#f8fafc]/50 space-y-6 px-10 h-full flex flex-col items-center justify-center">
                <div className="w-24 h-24 bg-white rounded-[5px] flex items-center justify-center text-[#cbd5e1] border border-[#dfe7f1] shadow-xl">
                   <AlertCircle size={48} />
                </div>
                <div className="space-y-3">
                   <h3 className="text-[18px] font-[800] text-[#0f172a] uppercase tracking-[0.2em]">Select a Detection</h3>
                   <p className="text-[13px] text-[#64748b] font-[500] leading-relaxed uppercase tracking-wider max-w-sm">Select a detection to view its alert, notification delivery and resident safety information.</p>
                </div>
             </div>
           )}
         </div>
       </div>

       {showExportDialog && (
         <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
           <button
             type="button"
             aria-label="Close export dialog"
             className="absolute inset-0 bg-[#0f172a]/65 backdrop-blur-sm"
             onClick={() => {
               if (!isExporting) setShowExportDialog(false);
             }}
           />
           <div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar bg-white rounded-[6px] border border-[#dfe7f1] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
             <div className="sticky top-0 z-10 px-5 sm:px-7 py-5 bg-[#f8fafc] border-b border-[#dfe7f1] flex items-start justify-between gap-4">
               <div>
                 <h2 className="text-[17px] font-[800] text-[#0f172a] uppercase tracking-wider">Export Detection Data</h2>
                 <p className="text-[11px] font-[600] text-[#64748b] mt-1">Generate a guard-scoped report without detection images.</p>
               </div>
               <button
                 type="button"
                 onClick={() => setShowExportDialog(false)}
                 disabled={isExporting}
                 className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[5px] border border-[#dfe7f1] text-[#64748b] hover:bg-white hover:text-[#0f172a] disabled:opacity-50"
               >
                 <XCircle size={18} />
               </button>
             </div>

             <div className="p-5 sm:p-7 space-y-7">
               <section className="space-y-3">
                 <h3 className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em]">Format</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {[
                     { value: 'xlsx', label: 'Excel (.xlsx)', description: 'Two worksheets: detections and resident outcomes' },
                     { value: 'csv', label: 'CSV (.csv)', description: 'Flattened rows for each detection-resident relationship' }
                   ].map(option => (
                     <label
                       key={option.value}
                       className={`p-4 rounded-[5px] border cursor-pointer transition-all ${
                         exportFormat === option.value
                           ? 'border-[#1768d1] bg-[#eaf2ff]/50'
                           : 'border-[#dfe7f1] hover:border-[#1768d1]/30'
                       }`}
                     >
                       <div className="flex items-start gap-3">
                         <input
                           type="radio"
                           name="export-format"
                           value={option.value}
                           checked={exportFormat === option.value}
                           onChange={(event) => setExportFormat(event.target.value)}
                           className="mt-1 accent-[#1768d1]"
                         />
                         <div>
                           <p className="text-[12px] font-[800] text-[#0f172a] uppercase tracking-wider">{option.label}</p>
                           <p className="text-[10.5px] text-[#64748b] mt-1 leading-relaxed">{option.description}</p>
                         </div>
                       </div>
                     </label>
                   ))}
                 </div>
               </section>

               <section className="space-y-3">
                 <div className="flex items-center justify-between gap-4">
                   <h3 className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em]">Export Range</h3>
                   <span className="text-[9px] font-[800] text-[#1768d1] uppercase tracking-widest">
                     {selectedDetectionIds.length} selected
                   </span>
                 </div>
                 <div className="space-y-2">
                   {[
                     { value: 'all', label: 'All detections', description: 'Every detection belonging to your guard account' },
                     { value: 'selected', label: 'Selected detections', description: `${selectedDetectionIds.length} checkbox selection${selectedDetectionIds.length === 1 ? '' : 's'}`, disabled: selectedDetectionIds.length === 0 },
                     { value: 'filtered', label: 'Currently filtered results', description: `Status: ${statusFilter}${searchTerm.trim() ? ` · Search: ${searchTerm.trim()}` : ''}` },
                     { value: 'current', label: 'Current detection only', description: selectedDetection ? selectedDetection.locationName : 'No detection is currently open', disabled: !selectedDetection },
                     { value: 'dateRange', label: 'Custom date range', description: 'Choose inclusive dates and optionally filter by location' }
                   ].map(option => (
                     <label
                       key={option.value}
                       className={`flex items-start gap-3 p-3.5 rounded-[5px] border transition-all ${
                         option.disabled
                           ? 'border-[#edf1f6] bg-[#f8fafc] opacity-55 cursor-not-allowed'
                           : exportScope === option.value
                             ? 'border-[#1768d1] bg-[#eaf2ff]/40 cursor-pointer'
                             : 'border-[#dfe7f1] hover:border-[#1768d1]/30 cursor-pointer'
                       }`}
                     >
                       <input
                         type="radio"
                         name="export-scope"
                         value={option.value}
                         checked={exportScope === option.value}
                         onChange={(event) => {
                           setExportScope(event.target.value);
                           setExportErrors({});
                         }}
                         disabled={option.disabled}
                         className="mt-1 accent-[#1768d1]"
                       />
                       <div>
                         <p className="text-[11px] font-[800] text-[#0f172a] uppercase tracking-wider">{option.label}</p>
                         <p className="text-[10.5px] text-[#64748b] mt-1">{option.description}</p>
                       </div>
                     </label>
                   ))}
                 </div>
                 {exportErrors.scope && (
                   <p className="text-[11px] font-[700] text-[#e02424]">{exportErrors.scope}</p>
                 )}
               </section>

               {exportScope === 'dateRange' && (
                 <section className="p-4 sm:p-5 bg-[#f8fafc] border border-[#dfe7f1] rounded-[5px] space-y-4">
                   <h3 className="text-[10px] font-[800] text-[#334155] uppercase tracking-[0.2em]">Custom Filters</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                       <label className="text-[10px] font-[800] text-[#64748b] uppercase tracking-widest block mb-2">Start Date</label>
                       <input
                         type="date"
                         value={exportFilters.startDate}
                         onChange={(event) => setExportFilters(prev => ({ ...prev, startDate: event.target.value }))}
                         className="h-11 px-3 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] outline-none focus:border-[#1768d1]"
                       />
                       {exportErrors.startDate && <p className="text-[10px] font-[700] text-[#e02424] mt-1.5">{exportErrors.startDate}</p>}
                     </div>
                     <div>
                       <label className="text-[10px] font-[800] text-[#64748b] uppercase tracking-widest block mb-2">End Date</label>
                       <input
                         type="date"
                         value={exportFilters.endDate}
                         onChange={(event) => setExportFilters(prev => ({ ...prev, endDate: event.target.value }))}
                         className="h-11 px-3 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] outline-none focus:border-[#1768d1]"
                       />
                       {exportErrors.endDate && <p className="text-[10px] font-[700] text-[#e02424] mt-1.5">{exportErrors.endDate}</p>}
                     </div>
                   </div>
                   <div>
                     <label className="text-[10px] font-[800] text-[#64748b] uppercase tracking-widest block mb-2">Location / Area (optional)</label>
                     <div className="relative">
                       <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={15} />
                       <input
                         type="text"
                         value={exportFilters.location}
                         onChange={(event) => setExportFilters(prev => ({ ...prev, location: event.target.value }))}
                         placeholder="Example: Matara"
                         className="h-11 pl-10 pr-3 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] outline-none focus:border-[#1768d1]"
                       />
                     </div>
                   </div>
                 </section>
               )}
             </div>

             <div className="sticky bottom-0 px-5 sm:px-7 py-4 bg-white border-t border-[#dfe7f1] flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
               <button
                 type="button"
                 onClick={() => setShowExportDialog(false)}
                 disabled={isExporting}
                 className="h-11 px-6 rounded-[5px] border border-[#dfe7f1] text-[#64748b] font-[800] text-[11px] uppercase tracking-widest hover:bg-[#f8fafc] disabled:opacity-50"
               >
                 Cancel
               </button>
               <button
                 type="button"
                 onClick={handleExport}
                 disabled={isExporting}
                 className="h-11 px-7 rounded-[5px] bg-[#1768d1] text-white font-[800] text-[11px] uppercase tracking-widest hover:bg-[#0f56b3] disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2"
               >
                 {isExporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                 {isExporting ? 'Exporting...' : 'Export Data'}
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
  );
};

export default DetectionHistory;
