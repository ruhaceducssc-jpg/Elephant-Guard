import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import L from 'leaflet';
import { io } from 'socket.io-client';
import { MapPin, Shield, AlertCircle, Clock, CheckCircle, X, Navigation, Filter, Layers, Zap, User } from 'lucide-react';

// Premium Custom Marker Styles
const createCustomMarker = (status, isNew = false, isSelected = false) => {
  const colors = {
    new: '#ef4444',
    acknowledged: '#f59e0b',
    resolved: '#10b981',
    dismissed: '#6b7280'
  };
  
  const color = colors[status] || colors.new;
  const pulseClass = isNew ? 'animate-ping' : '';
  const scaleClass = isSelected ? 'scale-125 border-4' : 'scale-100 border-2';

  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="relative flex items-center justify-center">
        ${isNew ? `<div class="absolute w-12 h-12 bg-[${color}] rounded-full opacity-20 ${pulseClass}"></div>` : ''}
        <div class="w-10 h-10 bg-white rounded-2xl shadow-2xl flex items-center justify-center ${scaleClass} border-[${color}] relative z-10 transition-all duration-500">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="absolute -bottom-1 w-2 h-2 bg-[${color}] rotate-45 z-0"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 13, { duration: 2 });
  }, [center, zoom, map]);
  return null;
};

const LiveMap = () => {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [residents, setResidents] = useState([]);
  const [center, setCenter] = useState([7.8731, 80.7718]);
  const [zoom, setZoom] = useState(10);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showResidents, setShowResidents] = useState(true);
  const markerRefs = useRef({});

  // Safety date formatter
  const safeFormat = (date, formatStr) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : '--:--';
  };

  const fetchData = async () => {
    try {
      const [alertsRes, residentsRes] = await Promise.all([
        api.get('/alerts'),
        api.get('/users')
      ]);
      
      const allAlerts = Array.isArray(alertsRes.data) ? alertsRes.data : [];
      const allResidents = Array.isArray(residentsRes.data) ? residentsRes.data : [];
      
      setAlerts(allAlerts);
      setResidents(allResidents);
      
      if (alertId) {
        const target = allAlerts.find(a => (a.id || a._id) === alertId);
        if (target) {
          const targetPos = [target.latitude || target.location?.coordinates[1] || 7.8731, target.longitude || target.location?.coordinates[0] || 80.7718];
          setCenter(targetPos);
          setZoom(15);
          setSelectedAlert(target);
          fetchNotifications(target.id || target._id);
          
          setTimeout(() => {
            const marker = markerRefs.current[target.id || target._id];
            if (marker) marker.openPopup();
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Data sync failure');
    }
  };

  const fetchNotifications = async (id) => {
    if (!id) return;
    setIsNotificationsLoading(true);
    try {
      const { data } = await api.get(`/alerts/${id}/notifications`);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch notifications');
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
      if (!alertId) {
        const lat = newAlert.latitude || newAlert.location?.coordinates[1] || 7.8731;
        const lng = newAlert.longitude || newAlert.location?.coordinates[0] || 80.7718;
        setCenter([lat, lng]);
        setZoom(13);
        setSelectedAlert(newAlert);
        fetchNotifications(newAlert.id || newAlert._id);
      }
    });

    socket.on('alert-updated', (updatedAlert) => {
      setAlerts(prev => prev.map(a => (a.id || a._id) === (updatedAlert.id || updatedAlert._id) ? updatedAlert : a));
      if (selectedAlert && (selectedAlert.id || selectedAlert._id) === (updatedAlert.id || updatedAlert._id)) {
        setSelectedAlert(updatedAlert);
      }
    });

    return () => socket.disconnect();
  }, [alertId]);

  const filteredAlerts = alerts.filter(a => filter === 'all' || a.alertStatus === filter);

  const isResidentAffected = (residentId) => {
    if (!selectedAlert || !selectedAlert.affectedResidentIds) return false;
    return selectedAlert.affectedResidentIds.includes(residentId);
  };

  const handleMarkerClick = (alert) => {
    const lat = alert.latitude || alert.location?.coordinates[1] || 7.8731;
    const lng = alert.longitude || alert.location?.coordinates[0] || 80.7718;
    setSelectedAlert(alert);
    setCenter([lat, lng]);
    setZoom(15);
    navigate(`/dashboard/map/${alert.id || alert._id}`, { replace: true });
    fetchNotifications(alert.id || alert._id);
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full relative overflow-hidden bg-gray-900">
      <div className={`absolute top-6 left-6 z-[1000] transition-all duration-500 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[120%]'}`}>
        <div className="w-80 bg-white/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.3)] border border-white/40 overflow-hidden">
          <div className="p-8 pb-4">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-200">
                      <Shield size={20} />
                   </div>
                   <div>
                      <h2 className="font-black text-gray-900 text-sm uppercase tracking-tighter">Live Sentinel</h2>
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                         <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Grid Active</span>
                      </div>
                   </div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                   <X size={20} />
                </button>
             </div>

             <div className="flex gap-2 mb-4">
                {['all', 'new', 'acknowledged'].map(f => (
                  <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {f}
                  </button>
                ))}
             </div>

             <div className="flex items-center justify-between mb-6 px-1">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Show Resident Zones</span>
                <button 
                  onClick={() => setShowResidents(!showResidents)}
                  className={`w-10 h-5 rounded-full transition-all relative ${showResidents ? 'bg-primary-600' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showResidents ? 'left-6' : 'left-1'}`}></div>
                </button>
             </div>
          </div>

          <div className="max-h-[40vh] overflow-y-auto px-4 pb-8 space-y-3 custom-scrollbar">
             {filteredAlerts.length === 0 ? (
               <div className="text-center py-10">
                  <Zap size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No Alerts in Sector</p>
               </div>
             ) : (
               filteredAlerts.map(alert => (
                 <div 
                   key={alert.id || alert._id}
                   onClick={() => handleMarkerClick(alert)}
                   className={`p-4 rounded-2xl border transition-all cursor-pointer ${(selectedAlert?.id || selectedAlert?._id) === (alert.id || alert._id) ? 'bg-primary-50 border-primary-200 shadow-sm' : 'bg-white/50 border-gray-100 hover:bg-white'}`}
                 >
                    <div className="flex justify-between items-start mb-2">
                       <h4 className="font-black text-gray-900 text-[11px] uppercase truncate w-40">{alert.locationName || alert.location?.locationName}</h4>
                       <span className="text-[9px] font-bold text-gray-400">{safeFormat(alert.detectedAt, 'HH:mm')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${alert.alertStatus === 'new' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{alert.alertStatus}</span>
                       </div>
                       {alert.affectedResidentIds?.length > 0 && (
                         <span className="text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">
                           {alert.affectedResidentIds.length} At Risk
                         </span>
                       )}
                    </div>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>

      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-6 left-6 z-[1000] w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-primary-600 hover:bg-primary-600 hover:text-white transition-all"
        >
          <Layers size={24} />
        </button>
      )}

      {selectedAlert && (
        <div className="absolute bottom-10 right-10 z-[1000] w-96 bg-white rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] border border-gray-100 overflow-hidden animate-in slide-in-from-bottom duration-500">
           <div className="h-48 relative">
              <img 
                src={selectedAlert.image ? `http://localhost:5000/uploads/${selectedAlert.image}` : '/assets/images/elephant-fallback.jpg'} 
                className="w-full h-full object-cover" 
                alt="Detection" 
              />
              <button 
                onClick={() => { setSelectedAlert(null); navigate('/dashboard/map'); }} 
                className="absolute top-6 right-6 p-2 bg-black/40 backdrop-blur-xl text-white rounded-xl hover:bg-black/60 transition-all"
              >
                 <X size={18} />
              </button>
              <div className="absolute bottom-4 left-6 px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-black text-white uppercase tracking-widest border border-white/20">
                 {((selectedAlert.confidence || 0) * 100).toFixed(0)}% Confidence
              </div>
           </div>
           <div className="p-8">
              <div className="flex justify-between items-start mb-4">
                 <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{selectedAlert.locationName || selectedAlert.location?.locationName}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{safeFormat(selectedAlert.detectedAt, 'PPPP p')}</p>
                 </div>
                 <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                   selectedAlert.alertStatus === 'new' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-amber-50 border-amber-100 text-amber-600'
                 }`}>
                   {selectedAlert.alertStatus}
                 </div>
              </div>

              {/* Notification Report Summary */}
              {selectedAlert.affectedResidentIds?.length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} className="text-primary-600" />
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Notification Report</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="text-[8px] font-black bg-green-100 text-green-600 px-1.5 py-0.5 rounded uppercase">
                        {notifications.filter(n => n.status === 'sent').length} OK
                      </span>
                      <span className="text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">
                        {notifications.filter(n => n.status === 'failed').length} Fail
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                    {isNotificationsLoading ? (
                      <div className="text-center py-4 animate-pulse">
                        <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Fetching Logs...</p>
                      </div>
                    ) : notifications.length === 0 ? (
                      <p className="text-[8px] font-bold text-gray-400 text-center py-2 uppercase">No Delivery Records</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n._id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-2">
                             <div className={`w-1.5 h-1.5 rounded-full ${n.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                             <span className="text-[9px] font-bold text-gray-700 truncate w-24 uppercase">{n.residentName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-[8px] font-mono text-gray-400">{((n.distanceFromElephant || 0) / 1000).toFixed(1)}km</span>
                             {n.status === 'failed' && (
                               <div className="group relative">
                                 <AlertCircle size={10} className="text-red-400" />
                                 <div className="absolute bottom-full right-0 mb-2 w-32 bg-gray-900 text-white text-[7px] p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-[3000]">
                                   {n.errorMessage}
                                 </div>
                               </div>
                             )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-6">
                 <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Coordinates</p>
                    <p className="text-[10px] font-mono font-bold text-gray-700">{(selectedAlert.latitude || selectedAlert.location?.coordinates[1] || 0).toFixed(4)}, {(selectedAlert.longitude || selectedAlert.location?.coordinates[0] || 0).toFixed(4)}</p>
                 </div>
                 <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Status</p>
                    <p className="text-[10px] font-bold text-gray-700 uppercase tracking-tighter">{selectedAlert.alertStatus}</p>
                 </div>
              </div>
              <button 
                onClick={() => navigate('/dashboard/history')}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Navigation size={16} /> Manage Sector
              </button>
           </div>
        </div>
      )}

      <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} className="h-full w-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; Stadia Maps'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="bottomleft" />
        <MapUpdater center={center} zoom={zoom} />
        
        {showResidents && residents.map(resident => {
          const isAffected = isResidentAffected(resident._id);
          const pos = [resident.areaLocation.coordinates[1], resident.areaLocation.coordinates[0]];
          return (
            <React.Fragment key={resident._id}>
              <Marker position={pos} icon={L.divIcon({
                  className: 'resident-icon',
                  html: `
                    <div class="relative group">
                      <div class="w-8 h-8 rounded-full border-2 ${isAffected ? 'bg-red-500 border-white animate-pulse' : 'bg-white border-primary-500'} flex items-center justify-center shadow-lg transition-all">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isAffected ? 'white' : '#0ea5e9'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                          <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                      </div>
                    </div>
                  `,
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
                })}>
                <Popup>
                  <div className="p-2">
                    <h5 className="font-black text-gray-900 text-[10px] uppercase mb-1">{resident.name}</h5>
                    <p className="text-[9px] text-gray-500 mb-2">{resident.village}</p>
                    <span className="text-[8px] font-black uppercase text-gray-400">Radius: {resident.geofenceRadiusMeters}m</span>
                  </div>
                </Popup>
              </Marker>
              <Circle center={pos} radius={resident.geofenceRadiusMeters || 1000} pathOptions={{
                  fillColor: isAffected ? '#ef4444' : '#0ea5e9',
                  color: isAffected ? '#ef4444' : '#0ea5e9',
                  weight: isAffected ? 2 : 1,
                  opacity: 0.4,
                  fillOpacity: isAffected ? 0.2 : 0.05,
                  dashArray: isAffected ? '5, 10' : 'none'
                }} />
            </React.Fragment>
          );
        })}

        {filteredAlerts.map(alert => (
          <React.Fragment key={alert.id || alert._id}>
            <Marker ref={el => markerRefs.current[alert.id || alert._id] = el} position={[alert.latitude || alert.location?.coordinates[1] || 7.8731, alert.longitude || alert.location?.coordinates[0] || 80.7718]} icon={createCustomMarker(alert.alertStatus, alert.alertStatus === 'new', (selectedAlert?.id || selectedAlert?._id) === (alert.id || alert._id))} eventHandlers={{ click: () => handleMarkerClick(alert) }}>
              <Popup className="premium-popup">
                <div className="p-3 min-w-[150px]">
                  <h4 className="font-black text-gray-900 text-xs uppercase mb-1">{alert.locationName || alert.location?.locationName}</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={12} className="text-gray-400" />
                    <p className="text-[10px] text-gray-500">{safeFormat(alert.detectedAt, 'HH:mm')}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider inline-block ${alert.alertStatus === 'new' ? 'bg-red-50 text-white' : 'bg-amber-50 text-white'}`}>
                    {alert.alertStatus === 'new' ? '⚠️ Active Alert' : alert.alertStatus}
                  </div>
                </div>
              </Popup>
            </Marker>
            {alert.alertStatus === 'new' && <Circle center={[alert.latitude || alert.location?.coordinates[1] || 7.8731, alert.longitude || alert.location?.coordinates[0] || 80.7718]} radius={500} pathOptions={{ fillColor: '#ef4444', color: '#ef4444', weight: 1, opacity: 0.3, fillOpacity: 0.1 }} />}
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
};

export default LiveMap;
