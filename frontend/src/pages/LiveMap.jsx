import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, Circle, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import { ShieldAlert, MapPin, Clock, Navigation, Zap, AlertTriangle, Layers, Maximize, X, Shield, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// Fix for default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Green Circle Style Icon - Improved
const greenCircleIcon = L.divIcon({
  className: 'custom-green-marker',
  html: `<div class="w-7 h-7 bg-success-600 rounded-full border-[3px] border-white shadow-xl flex items-center justify-center transition-transform hover:scale-110">
           <div class="w-2 h-2 bg-white rounded-full"></div>
         </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

// Component to handle map resize
const ResizeMap = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const LiveMap = () => {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([7.8731, 80.7718]);
  const [zoom, setZoom] = useState(8);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to convert GeoJSON Polygon to Leaflet latlngs
  const getPatrolAreaPath = () => {
    if (!user?.patrolArea?.coordinates?.[0]) return null;
    return user.patrolArea.coordinates[0].map(coord => [coord[1], coord[0]]);
  };

  const patrolAreaPath = getPatrolAreaPath();

  const fetchAlerts = async () => {
    try {
      const { data } = await api.get('/alerts');
      setAlerts(data);
      
      if (alertId) {
        const target = data.find(a => (a.id || a._id) === alertId);
        if (target) {
          setSelectedAlert(target);
          const coords = target.location?.coordinates || [target.longitude, target.latitude];
          if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
            setMapCenter([coords[1], coords[0]]);
            setZoom(15);
          }
        }
      } else if (data.length > 0) {
        const latest = data[0];
        const coords = latest.location?.coordinates || [latest.longitude, latest.latitude];
        if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
          setMapCenter([coords[1], coords[0]]);
          setZoom(10);
        }
      }
    } catch (error) {
      toast.error('Failed to sync map data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [alertId]);

  const handleSelfLocation = () => {
    if (!navigator.geolocation) {
      return toast.error('Geolocation is not supported by your browser');
    }

    toast.loading('Acquiring GPS signal...', { id: 'gps' });
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserLocation({ 
          lat: latitude, 
          lng: longitude, 
          accuracy,
          timestamp: new Date().toLocaleTimeString() 
        });
        setMapCenter([latitude, longitude]);
        setZoom(15);
        toast.success(`Location acquired (Accuracy: ${accuracy.toFixed(0)}m)`, { id: 'gps' });
      },
      (error) => {
        console.error('GPS error:', error);
        let msg = 'Failed to get location';
        if (error.code === 1) msg = 'Location permission denied';
        else if (error.code === 2) msg = 'Location unavailable';
        else if (error.code === 3) msg = 'Location request timed out';
        toast.error(msg, { id: 'gps' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleAlertSelect = (alert) => {
    setSelectedAlert(alert);
    const coords = alert.location?.coordinates || [alert.longitude, alert.latitude];
    if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
      setMapCenter([coords[1], coords[0]]);
      setZoom(16);
    } else {
      toast.error('Invalid coordinates for this alert');
    }
  };

  const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const safeFormat = (date, formatStr) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : 'N/A';
  };

  return (
    <div className="min-h-[calc(100vh-140px)] lg:h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-4 page-fade-in overflow-hidden lg:overflow-visible relative">
      
      {/* Tactical Monitor Panel */}
      <div className="lg:w-[350px] w-full shrink-0 flex flex-col order-2 lg:order-1 h-[350px] lg:h-full relative group/monitor">
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-soft flex flex-col h-full overflow-hidden">
           <div className="p-6 border-b border-slate-50 shrink-0">
              <div className="flex items-center justify-between px-1">
                 <h2 className="text-base font-bold text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                       <Navigation className="text-emerald-600" size={18} />
                    </div>
                    Live Monitor
                 </h2>
              </div>
              
              <button 
                onClick={handleSelfLocation}
                className="w-full btn btn-secondary flex items-center justify-center gap-2 py-2.5 mt-5 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 transition-all group shrink-0 text-slate-700"
              >
                <Maximize size={14} className="text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider">My GPS Location</span>
              </button>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-2xl"></div>)
              ) : alerts.length === 0 ? (
                <div className="text-center py-10 opacity-40">
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">No Active Nodes</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <button
                    key={alert.id || alert._id}
                    onClick={() => handleAlertSelect(alert)}
                    className={`w-full p-3.5 rounded-2xl border transition-all text-left group shrink-0 ${
                      (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id)
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm'
                        : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                       <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                         (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id)
                           ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                           : 'bg-slate-100 text-slate-400'
                       }`}>
                         <AlertTriangle size={16} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold tracking-tight truncate">{alert.locationName || alert.areaName}</p>
                          <div className="flex items-center gap-2 mt-0.5 opacity-60">
                             <Clock size={10} />
                             <span className="text-[10px] font-bold uppercase tracking-widest">{safeFormat(alert.detectedAt, 'HH:mm')}</span>
                          </div>
                       </div>
                    </div>
                  </button>
                ))
              )}
           </div>
        </div>
      </div>

      {/* Main Map Content */}
      <div className="flex-1 min-w-0 bg-white rounded-[2.5rem] border border-slate-200 shadow-soft overflow-hidden relative order-1 lg:order-2 h-[450px] lg:h-full">
        <MapContainer 
          center={mapCenter} 
          zoom={zoom} 
          className="h-full w-full"
          zoomControl={false}
        >
          <ChangeView center={mapCenter} zoom={zoom} />
          <ResizeMap />
          <TileLayer
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
          />
          <ZoomControl position="bottomright" />
          
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>
                <div className="p-2 space-y-1">
                  <p className="font-bold text-emerald-700 text-sm">My Current Location</p>
                  <p className="text-[10px] text-slate-500 font-mono">{userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}</p>
                  <p className="text-[10px] text-slate-400">Accuracy: {userLocation.accuracy.toFixed(1)}m</p>
                </div>
              </Popup>
              <Circle center={[userLocation.lat, userLocation.lng]} radius={userLocation.accuracy} pathOptions={{ color: '#10b981', weight: 1, fillOpacity: 0.1 }} />
            </Marker>
          )}

          {alerts.map((alert) => {
            const coords = alert.location?.coordinates || [alert.longitude, alert.latitude];
            const isSelected = (selectedAlert?.id === alert.id || selectedAlert?._id === alert._id);
            
            return (
              <React.Fragment key={alert.id || alert._id}>
                <Marker 
                  position={[coords[1], coords[0]]}
                  icon={greenCircleIcon}
                  eventHandlers={{
                    click: () => setSelectedAlert(alert),
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-3 space-y-1">
                       <p className="font-bold text-slate-900">{alert.locationName || alert.areaName}</p>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{safeFormat(alert.detectedAt, 'PPP p')}</p>
                       {alert.insidePatrolArea && (
                         <div className="flex items-center gap-1.5 mt-2 py-1 px-2 bg-rose-50 text-rose-700 rounded-md border border-rose-100">
                            <AlertTriangle size={10} />
                            <span className="text-[9px] font-bold uppercase tracking-tight">Inside Patrol Zone</span>
                         </div>
                       )}
                    </div>
                  </Popup>
                </Marker>
                {/* 1km Danger Zone Circle - only if inside patrol area */}
                {alert.insidePatrolArea && (
                  <Circle 
                    center={[coords[1], coords[0]]} 
                    radius={1000} 
                    pathOptions={{ 
                      fillColor: '#f43f5e', 
                      color: '#be123c', 
                      weight: 2, 
                      opacity: 0.6, 
                      fillOpacity: 0.15,
                      dashArray: '5, 10' 
                    }} 
                  />
                )}
                {isSelected && <Circle center={[coords[1], coords[0]]} radius={500} pathOptions={{ fillColor: '#10b981', color: '#10b981', weight: 1, opacity: 0.3, fillOpacity: 0.1 }} />}
              </React.Fragment>
            );
          })}

          {/* Guard Patrol Area Polygon */}
          {patrolAreaPath && (
            <Polygon 
              positions={patrolAreaPath} 
              pathOptions={{ 
                color: '#059669', 
                fillColor: '#10b981', 
                fillOpacity: 0.05, 
                weight: 3,
                dashArray: '1'
              }} 
            >
              <Popup>
                <div className="p-1">
                   <p className="font-bold text-emerald-800 text-xs">My Patrol Boundary</p>
                   <p className="text-[10px] text-emerald-600">{user.assignedArea}</p>
                </div>
              </Popup>
            </Polygon>
          )}
        </MapContainer>

        <div className="absolute bottom-6 left-6 z-[1000] flex flex-col gap-2">
           <button className="p-3 bg-white border border-slate-200 shadow-lg rounded-2xl text-slate-500 hover:text-emerald-600 transition-all active:scale-95">
              <Layers size={18} />
           </button>
        </div>
      </div>

      {/* Right Panel: Details */}
      {selectedAlert && (
        <div className="w-full lg:w-[340px] shrink-0 flex flex-col order-3 lg:order-3 h-fit lg:h-full animate-in fade-in slide-in-from-right-8 duration-500">
          <DetectionDetailsPanel 
            alert={selectedAlert} 
            onClose={() => setSelectedAlert(null)} 
            safeFormat={safeFormat}
            onGoToAlert={(id) => navigate(`/dashboard/history?highlight=${id}`)}
          />
        </div>
      )}
    </div>
  );
};

const DetectionDetailsPanel = ({ alert, onClose, safeFormat, onGoToAlert }) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden flex flex-col h-full">
      <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between shrink-0">
         <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Incident Details</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">#{alert.id?.slice(-6).toUpperCase() || alert._id?.slice(-6).toUpperCase()}</p>
         </div>
         <div className="flex items-center gap-2">
            {alert.insidePatrolArea && (
               <div className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-100 flex items-center gap-1.5 animate-pulse">
                  <Shield size={10} />
                  <span className="text-[8px] font-bold uppercase tracking-tighter">Active Threat</span>
               </div>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
               <X size={16} />
            </button>
         </div>
      </div>
      
      <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
         <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Confidence</p>
               <p className="text-lg font-bold text-slate-900 mt-0.5">{(alert.confidence * 100).toFixed(0)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center flex flex-col justify-center items-center">
               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Patrol Zone</p>
               <div className={`flex items-center gap-1 mt-1 ${alert.insidePatrolArea ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {alert.insidePatrolArea ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  <p className="text-[10px] font-bold uppercase tracking-wider">{alert.insidePatrolArea ? 'Inside' : 'Outside'}</p>
               </div>
            </div>
         </div>

         <div className="space-y-4">
            <div className="flex items-start gap-3">
               <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={14} />
               </div>
               <div className="min-w-0">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Location</p>
                  <p className="text-xs font-bold text-slate-800 tracking-tight break-words">{alert.locationName || alert.areaName}</p>
               </div>
            </div>
            <div className="flex items-start gap-3">
               <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={14} />
               </div>
               <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Time</p>
                  <p className="text-xs font-bold text-slate-800 tracking-tight">{safeFormat(alert.detectedAt, 'PP p')}</p>
               </div>
            </div>
            <div className="flex items-start gap-3">
               <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Navigation size={14} />
               </div>
               <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">GPS</p>
                  <p className="text-[10px] font-mono font-bold text-slate-700">
                    {alert.location?.coordinates ? `${alert.location.coordinates[1].toFixed(4)}, ${alert.location.coordinates[0].toFixed(4)}` : 'N/A'}
                  </p>
               </div>
            </div>
         </div>

         <div className="pt-4 mt-auto">
            <button 
              onClick={() => onGoToAlert(alert.id || alert._id)}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95"
            >
              <Zap size={12} />
              Go to Alert History
            </button>
         </div>
      </div>
    </div>
  );
};

export default LiveMap;
