import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, Circle, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import { 
  ShieldAlert, MapPin, Clock, Navigation, Zap, 
  AlertTriangle, Layers, Maximize, X, Shield, CheckCircle, User, Send, Home, Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';

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

/**
 * Robust detection normalization helper
 */
const normalizeDetection = (record) => {
  if (!record) return null;
  
  const source = record.detection || record.alert || record;
  const coordinates = source.location?.coordinates || source.coordinates;
  
  const latitude = Number(coordinates?.[1] ?? source.latitude ?? source.lat);
  const longitude = Number(coordinates?.[0] ?? source.longitude ?? source.lng);
  
  return {
    ...source,
    id: source.id || source._id?.toString() || record.detectionId || record.alertId,
    _id: source._id?.toString() || record.detectionId || record.alertId,
    latitude,
    longitude,
    locationName: source.locationName || 'Sector Analyzed',
    confidence: source.confidence || 0,
    detectedAt: source.detectedAt || source.createdAt,
    image: source.imageUrl || source.image || '',
    status: source.status || 'active'
  };
};

/**
 * Coordinate validation helper
 */
const isValidLocation = (lat, lng) => {
  return (
    Number.isFinite(lat) && 
    Number.isFinite(lng) && 
    lat >= -90 && lat <= 90 && 
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
};

const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

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
  const [searchParams] = useSearchParams();
  const queryResidentId = searchParams.get('residentId');
  const queryDetectionId = searchParams.get('detectionId');
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [detections, setDetections] = useState([]);
  const [residents, setResidents] = useState([]);
  const [selectedMapObject, setSelectedMapObject] = useState(null);
  const [highlightedDetectionId, setHighlightedDetectionId] = useState(null);
  
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([7.8731, 80.7718]);
  const [zoom, setZoom] = useState(8);
  const [isLoading, setIsLoading] = useState(true);

  // Professional Elephant Marker Icon Generator
  const getElephantIcon = (isHighlighted) => L.divIcon({
    className: 'elephant-detection-marker-wrapper',
    html: `
      <div class="elephant-detection-marker ${isHighlighted ? 'lb-elephant-marker--highlighted' : ''}">
        <img
          src="/map-icons/detedted.png"
          alt=""
          aria-hidden="true"
          style="width: 42px; height: 42px; object-fit: contain;"
        />
      </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24]
  });

  // Blue House Marker Icon
  const houseIcon = L.divIcon({
    className: 'lb-house-marker-wrapper',
    html: `
      <div style="
        width: 36px; 
        height: 36px; 
        background: #1768d1; 
        border-radius: 5px; 
        border: 2px solid white; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      " class="hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });

  const getPatrolAreaPath = () => {
    if (!user?.patrolArea?.coordinates?.[0]) return null;
    return user.patrolArea.coordinates[0].map(coord => [coord[1], coord[0]]);
  };

  const patrolAreaPath = getPatrolAreaPath();

  const handleDetectionSelect = useCallback((det) => {
    const normalized = normalizeDetection(det);
    if (!normalized) return;

    setSelectedMapObject({ type: 'elephant', id: normalized.id, data: normalized });
    setHighlightedDetectionId(normalized.id);
    
    if (isValidLocation(normalized.latitude, normalized.longitude)) {
      setMapCenter([normalized.latitude, normalized.longitude]);
      setZoom(16);
    }

    // Clear highlight after 2.5 seconds
    setTimeout(() => {
      setHighlightedDetectionId(null);
    }, 2500);
  }, []);

  const handleResidentSelect = useCallback((resident) => {
    setSelectedMapObject({ type: 'resident', id: resident._id, data: resident });
    const coords = resident.areaLocation?.coordinates || [resident.longitude, resident.latitude];
    if (coords && isValidLocation(coords[1], coords[0])) {
      setMapCenter([coords[1], coords[0]]);
      setZoom(16);
    }
  }, []);

  const fetchMapData = useCallback(async () => {
    try {
      const [detRes, residentsRes] = await Promise.all([
        api.get('/detections'),
        api.get('/users')
      ]);
      
      const rawDetections = Array.isArray(detRes.data) ? detRes.data : [];
      const normalizedDetections = rawDetections
        .map(normalizeDetection)
        .filter(d => d && isValidLocation(d.latitude, d.longitude));

      const residentsData = Array.isArray(residentsRes.data) ? residentsRes.data : [];
      
      setDetections(normalizedDetections);
      setResidents(residentsData);
      
      // Focus Logic: URL Params
      const focusDetectionId = alertId || queryDetectionId;
      
      if (queryResidentId) {
        const targetRes = residentsData.find(r => r._id === queryResidentId);
        if (targetRes) {
          handleResidentSelect(targetRes);
        }
      } else if (focusDetectionId) {
        const targetDet = normalizedDetections.find(d => d.id === focusDetectionId);
        if (targetDet) {
          handleDetectionSelect(targetDet);
        } else {
          // If not in list, fetch specifically
          try {
            const { data } = await api.get(`/detections/${focusDetectionId}`);
            const specificDet = normalizeDetection(data);
            if (specificDet && isValidLocation(specificDet.latitude, specificDet.longitude)) {
              setDetections(prev => [specificDet, ...prev]);
              handleDetectionSelect(specificDet);
            }
          } catch (e) {
            console.error('Failed to fetch specific detection:', e);
          }
        }
      } else if (normalizedDetections.length > 0) {
        // Default view: Latest detection
        const latest = normalizedDetections[0];
        setMapCenter([latest.latitude, latest.longitude]);
        setZoom(10);
      }
    } catch (error) {
      console.error('Map sync error:', error);
      toast.error('Failed to sync map data');
    } finally {
      setIsLoading(false);
    }
  }, [alertId, queryResidentId, queryDetectionId, handleDetectionSelect, handleResidentSelect]);

  useEffect(() => {
    fetchMapData();

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const guardId = userData.id || userData._id;

    if (guardId) {
      socket.emit('join', guardId);
    }

    // Listener for new elephant detections
    const handleNewDetection = (payload) => {
      const normalized = normalizeDetection(payload);
      if (!normalized || !isValidLocation(normalized.latitude, normalized.longitude)) return;

      setDetections(prev => {
        const exists = prev.some(d => d.id === normalized.id);
        if (exists) return prev;
        return [normalized, ...prev];
      });
      
      toast('Real-time elephant detection synced', { 
        icon: '🐘',
        style: { borderRadius: '5px', background: '#0f172a', color: '#fff' }
      });
    };

    socket.on('new-elephant-detection', handleNewDetection);
    socket.on('new-detection', (data) => handleNewDetection(data)); // Legacy fallback

    socket.on('detection-status-updated', (updated) => {
       setDetections(prev => prev.map(d => d.id === (updated.id || updated.detectionId) ? { ...d, ...updated } : d));
    });

    socket.on('connect', () => {
      console.log('Map socket connected');
      // Re-fetch data on reconnect to ensure no missed events
      fetchMapData();
    });

    return () => {
      socket.off('new-elephant-detection');
      socket.off('new-detection');
      socket.disconnect();
    };
  }, [fetchMapData]);

  const handleSelfLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation restricted');
    toast.loading('Acquiring signal...', { id: 'gps' });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude, longitude, accuracy } = p.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        setMapCenter([latitude, longitude]);
        setZoom(15);
        toast.success('Signal verified', { id: 'gps' });
      },
      (e) => toast.error('Signal lost', { id: 'gps' }),
      { enableHighAccuracy: true }
    );
  };

  const safeFormat = (date, formatStr) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : 'N/A';
  };

  const clearSelection = () => {
    setSelectedMapObject(null);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-[14px] page-fade-in overflow-hidden relative max-w-[1920px] mx-auto box-border">
      
      {/* Main Map Content */}
      <div className={`flex-1 min-w-0 card relative h-full overflow-hidden border-[#dfe7f1] transition-all duration-500 ${selectedMapObject ? 'lg:flex-[3]' : 'lg:flex-[4]'}`}>
        <MapContainer 
          center={mapCenter} 
          zoom={zoom} 
          className="h-full w-full z-0"
          zoomControl={false}
          onClick={clearSelection}
        >
          <ChangeView center={mapCenter} zoom={zoom} />
          <ResizeMap />
          <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png" />
          <ZoomControl position="bottomright" />
          
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]}>
              <Circle center={[userLocation.lat, userLocation.lng]} radius={userLocation.accuracy} pathOptions={{ color: '#0b2d63', weight: 1, fillOpacity: 0.1 }} />
            </Marker>
          )}

          {/* Elephant Markers */}
          {detections.map((det) => (
            <Marker 
              key={det.id}
              position={[det.latitude, det.longitude]}
              icon={getElephantIcon(highlightedDetectionId === det.id || selectedMapObject?.id === det.id)}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  handleDetectionSelect(det);
                },
              }}
            >
              <Popup className="custom-popup">
                <div className="p-4 space-y-2">
                   <p className="font-[800] text-[#ef3535] uppercase text-[12px] tracking-widest leading-tight">Elephant Identified</p>
                   <p className="text-[10px] text-[#64748b] font-[700] uppercase tracking-widest">{det.locationName}</p>
                   {det.insideGuardArea && (
                     <div className="flex items-center gap-2 mt-2 py-1.5 px-3 bg-[#fff1f1] text-[#c81e1e] rounded-[5px] border border-[#facaca]">
                        <AlertTriangle size={12} />
                        <span className="text-[10px] font-[800] uppercase tracking-tight">Patrol Area Breach</span>
                     </div>
                   )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Resident Markers */}
          {residents.map((resident) => {
            const coords = resident?.areaLocation?.coordinates || [resident?.longitude, resident?.latitude];
            if (!coords || !isValidLocation(coords[1], coords[0])) return null;

            return (
              <Marker 
                key={resident._id}
                position={[coords[1], coords[0]]}
                icon={houseIcon}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    handleResidentSelect(resident);
                  },
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-4 space-y-1">
                     <p className="font-[800] text-[#1768d1] uppercase text-[12px] tracking-widest leading-tight">{resident.name}</p>
                     <p className="text-[10px] text-[#64748b] font-[700] uppercase tracking-widest">{resident.village}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {selectedMapObject?.type === 'resident' && (
            <Circle 
              center={[
                selectedMapObject.data.areaLocation?.coordinates?.[1] || selectedMapObject.data.latitude,
                selectedMapObject.data.areaLocation?.coordinates?.[0] || selectedMapObject.data.longitude
              ]} 
              radius={selectedMapObject.data.geofenceRadiusMeters || 1000} 
              pathOptions={{ color: '#1768d1', fillColor: '#2878e8', fillOpacity: 0.14, opacity: 0.85, weight: 2 }} 
            />
          )}

          {patrolAreaPath && (
            <Polygon 
              positions={patrolAreaPath} 
              pathOptions={{ color: '#119c55', fillColor: '#119c55', fillOpacity: 0.05, weight: 3, dashArray: '5, 10' }} 
            />
          )}
        </MapContainer>

        {/* Floating Controls Overlay */}
        <div className="absolute top-6 left-6 z-[500] flex flex-col gap-3">
           <div className="px-5 py-3 bg-[#0f172a]/95 backdrop-blur-sm rounded-[5px] border border-white/10 text-white shadow-2xl flex items-center gap-4">
              <div className="w-2.5 h-2.5 bg-[#18b866] rounded-full animate-pulse shadow-[0_0_8px_rgba(24,184,102,0.6)]"></div>
              <span className="text-[11px] font-[800] uppercase tracking-[0.2em]">Operational Grid Active</span>
           </div>
           <div className="flex gap-2">
              <button onClick={handleSelfLocation} className="h-10 px-4 bg-white border border-[#dfe7f1] text-[#334155] rounded-[5px] font-[700] text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-[#f8fafc] transition-all">
                <Maximize size={16} className="text-[#1768d1]" />
                GPS Sync
              </button>
           </div>
        </div>
        
        {/* Map Legend */}
        <div className="absolute bottom-6 left-6 z-[500] p-4 bg-white/95 border border-[#dfe7f1] rounded-[5px] shadow-2xl hidden md:block space-y-3">
           <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] border-b border-[#edf1f6] pb-2 mb-2">System Legend</p>
           <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                 <img src="/map-icons/detedted.png" alt="" aria-hidden="true" className="w-6 h-6 object-contain" />
                 <span className="text-[10px] font-[700] text-[#334155] uppercase tracking-wider">Elephant Detection</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-6 h-6 rounded-full bg-[#1768d1] border-2 border-white shadow-sm flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                 </div>
                 <span className="text-[10px] font-[700] text-[#334155] uppercase tracking-wider">Resident Location</span>
              </div>
              <div className="flex items-center gap-3 pl-0.5">
                 <div className="w-5 h-5 rounded-full border-2 border-[#1768d1] bg-[#2878e8]/10"></div>
                 <span className="text-[10px] font-[700] text-[#334155] uppercase tracking-wider">Geofence Perimeter</span>
              </div>
              <div className="flex items-center gap-3 pl-0.5">
                 <div className="w-5 h-0.5 bg-[#119c55]" style={{ borderBottom: '2px dashed #119c55' }}></div>
                 <span className="text-[10px] font-[700] text-[#334155] uppercase tracking-wider">Patrol Sector</span>
              </div>
           </div>
        </div>
      </div>

      {/* Right Panel: Details */}
      {selectedMapObject ? (
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col h-fit lg:h-full animate-in fade-in slide-in-from-right-8 duration-500 box-border">
          <MarkerDetailsPanel 
            type={selectedMapObject.type}
            data={selectedMapObject.data}
            onClose={clearSelection} 
            safeFormat={safeFormat}
            onGoToAlert={(id) => navigate(`/dashboard/history?highlight=${id}`)}
          />
        </div>
      ) : (
        <div className="hidden lg:flex lg:w-[380px] shrink-0 card flex-col bg-white border-[#dfe7f1] h-full box-border">
           <div className="px-6 py-[18px] border-b border-[#dfe7f1] bg-[#f8fafc] shrink-0">
              <h2 className="text-[13px] font-[800] text-[#0f172a] uppercase tracking-widest">Operational Monitor</h2>
           </div>
           <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-5 opacity-40">
              <div className="w-20 h-20 rounded-[5px] border-2 border-dashed border-[#cbd5e1] flex items-center justify-center text-[#94a3b8]">
                <Shield size={40} />
              </div>
              <div className="space-y-2">
                 <p className="text-[12px] font-[800] uppercase tracking-widest text-[#64748b]">Select map marker</p>
                 <p className="text-[11px] font-[600] text-[#94a3b8] leading-relaxed uppercase">Review detection details or resident status</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const MarkerDetailsPanel = ({ type, data, onClose, safeFormat, onGoToAlert }) => {
  const isAlert = type === 'elephant';
  const latitude = isAlert ? data.latitude : (data.areaLocation?.coordinates?.[1] || data.latitude);
  const longitude = isAlert ? data.longitude : (data.areaLocation?.coordinates?.[0] || data.longitude);

  return (
    <div className="card h-full flex flex-col bg-white border-[#dfe7f1] box-border">
      <div className="bg-[#f8fafc] border-b border-[#dfe7f1] px-6 py-[18px] flex items-center justify-between shrink-0">
         <div>
            <h3 className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.15em]">{isAlert ? 'Detection Data' : 'Resident Node'}</h3>
            <p className="text-[14px] font-[800] text-[#0f172a] mt-1.5 leading-none uppercase truncate">
              {isAlert ? `REF: #${(data.id || data._id)?.slice(-6)}` : data.name}
            </p>
         </div>
         <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] rounded-[5px] transition-colors border border-[#dfe7f1]">
            <X size={18} />
         </button>
      </div>
      
      <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">
         {isAlert ? (
           <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-full aspect-video rounded-[5px] overflow-hidden border border-[#dfe7f1] shadow-lg bg-slate-100">
                 <img 
                   src={data.image ? (data.image.startsWith('http') ? data.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${data.image}`) : '/assets/images/elephant-fallback.jpg'} 
                   alt="Detection" 
                   className="w-full h-full object-cover"
                 />
              </div>
              <span className={`badge w-full py-2.5 font-[800] text-[11px] tracking-widest uppercase rounded-[5px] ${data.insideGuardArea ? 'bg-[#fff1f1] text-[#c81e1e] border-[#facaca]' : 'bg-[#eaf2ff] text-[#1768d1] border-[#1768d1]/20'}`}>
                 {data.insideGuardArea ? 'Patrol Area Breach' : 'Exterior Detection'}
              </span>
           </div>
         ) : (
           <div className="flex flex-col items-center text-center space-y-5">
              <div className="w-24 h-24 rounded-[5px] bg-[#eaf2ff] flex items-center justify-center text-[#1768d1] border-2 border-white shadow-xl shadow-[#1768d1]/10">
                 <User size={48} />
              </div>
              <div className="space-y-1">
                 <h3 className="text-xl font-[800] text-[#0f172a] tracking-tight">{data.name}</h3>
                 <p className="text-[11px] font-[700] text-[#64748b] uppercase tracking-widest">{data.village}</p>
              </div>
              <div className={`badge px-5 py-2 rounded-[5px] ${data.notificationEnabled ? 'badge-success bg-[#edfcf4] text-[#0e7a42] border-[#b7efcf]' : 'badge-slate bg-[#f1f5f9] text-[#64748b] border-[#dbe4ef]'}`}>
                 {data.notificationEnabled ? 'ALERTS ACTIVE' : 'ALERTS DISABLED'}
              </div>
           </div>
         )}

         <div className="grid grid-cols-2 gap-[10px]">
            <div className="p-4 bg-[#f8fafc] rounded-[5px] border border-[#dfe7f1] text-center shadow-sm">
               <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-widest text-center">{isAlert ? 'AI Confidence' : 'Status'}</p>
               <p className="text-[22px] font-[800] text-[#0f172a] mt-1.5 leading-none">
                 {isAlert ? `${(data.confidence * 100).toFixed(0)}%` : 'VERIFIED'}
               </p>
            </div>
            <div className="p-4 bg-[#f8fafc] rounded-[5px] border border-[#dfe7f1] text-center flex flex-col justify-center items-center shadow-sm">
               <p className="text-[9px] font-[800] text-[#94a3b8] uppercase tracking-widest text-center">{isAlert ? 'Status' : 'System'}</p>
               <div className={`flex items-center gap-1.5 mt-2 ${isAlert ? (data.status === 'active' ? 'text-[#ef3535]' : 'text-[#18b866]') : 'text-[#119c55]'}`}>
                  {isAlert && data.status === 'active' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                  <p className="text-[12px] font-[800] uppercase tracking-widest leading-none">
                    {isAlert ? data.status.toUpperCase() : 'ONLINE'}
                  </p>
               </div>
            </div>
         </div>

         <div className="space-y-0.5">
            {[
              { icon: isAlert ? <MapPin /> : <Navigation />, label: isAlert ? 'Location' : 'Village', value: isAlert ? data.locationName : data.village },
              { icon: isAlert ? <Clock /> : <Send />, label: isAlert ? 'Time' : 'Telegram ID', value: isAlert ? safeFormat(data.detectedAt, 'PP p') : (data.telegramChatId || 'NOT LINKED') },
              { icon: <Maximize />, label: 'Coordinates', value: latitude && longitude ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'N/A' },
              !isAlert && { icon: <Layers />, label: 'Geofence Radius', value: `${data.geofenceRadiusMeters || 1000} Meters` }
            ].filter(Boolean).map((item, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b border-[#edf1f6] last:border-0">
                 <div className="w-10 h-10 bg-[#f4f8ff] text-[#1768d1] rounded-[5px] flex items-center justify-center shrink-0 border border-[#eaf2ff]">
                    {React.cloneElement(item.icon, { size: 18 })}
                 </div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest leading-none">{item.label}</p>
                    <p className="text-[13px] font-[700] text-[#334155] mt-1.5 truncate leading-none">{item.value}</p>
                 </div>
              </div>
            ))}
         </div>

         {isAlert && (
           <div className="pt-6 mt-auto">
              <button 
                onClick={() => onGoToAlert(data.id || data._id)}
                className="w-full h-12 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-[#1768d1]/10 hover:bg-[#0f56b3] transition-all flex items-center justify-center gap-3"
              >
                <Activity size={16} />
                View Safety Logs
              </button>
           </div>
         )}
      </div>
    </div>
  );
};

export default LiveMap;
