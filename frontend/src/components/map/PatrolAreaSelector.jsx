import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Trash2, Undo, CheckCircle, Map as MapIcon, HelpCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
};

const MapController = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [points, map]);
  return null;
};

const PatrolAreaSelector = ({ initialPolygon, onSave }) => {
  const [points, setPoints] = useState([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  useEffect(() => {
    if (initialPolygon && initialPolygon.coordinates && initialPolygon.coordinates[0]) {
      // GeoJSON [lng, lat] -> Leaflet [lat, lng]
      const leafletPoints = initialPolygon.coordinates[0].map(coord => [coord[1], coord[0]]);
      // Remove last point if it's a duplicate (GeoJSON closed loop)
      if (leafletPoints.length > 1 && 
          leafletPoints[0][0] === leafletPoints[leafletPoints.length-1][0] && 
          leafletPoints[0][1] === leafletPoints[leafletPoints.length-1][1]) {
        leafletPoints.pop();
      }
      setPoints(leafletPoints);
      setIsConfirmed(true);
    }
  }, [initialPolygon]);

  const handleMapClick = (latlng) => {
    if (isConfirmed) {
      toast.error('Clear the area to define a new boundary');
      return;
    }
    // Add point to the array - allows unlimited points
    setPoints(prev => [...prev, [latlng.lat, latlng.lng]]);
  };

  const handleClear = () => {
    setPoints([]);
    setIsConfirmed(false);
  };

  const handleUndo = () => {
    if (isConfirmed) return;
    setPoints(prev => prev.slice(0, -1));
  };

  const handleSave = () => {
    if (points.length < 3) {
      toast.error('Please select at least 3 points to define an area');
      return;
    }
    
    // Close the loop for GeoJSON requirement: first point must equal last point
    const closedPoints = [...points, points[0]];
    // Leaflet [lat, lng] -> GeoJSON [lng, lat]
    const geoJSONCoordinates = [closedPoints.map(p => [p[1], p[0]])];
    
    setIsConfirmed(true);
    onSave({
      type: 'Polygon',
      coordinates: geoJSONCoordinates
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {points.length === 0 ? 'Click map to start' : 
             isConfirmed ? `Patrol Boundary Established (${points.length} Points)` : 
             `${points.length} Boundary Points Selected`}
         </p>
         {isConfirmed ? (
            <div className="flex items-center gap-1.5 text-success-600">
               <CheckCircle size={12} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Area Confirmed</span>
            </div>
         ) : points.length >= 3 && (
            <div className="flex items-center gap-1.5 text-amber-500 animate-pulse">
               <HelpCircle size={12} />
               <span className="text-[10px] font-bold uppercase tracking-widest">Ready to Confirm</span>
            </div>
         )}
      </div>

      <div className={`relative h-[400px] w-full rounded-2xl border ${isConfirmed ? 'border-success-500' : 'border-slate-200'} overflow-hidden shadow-inner bg-slate-100 group transition-colors duration-500`}>
        <MapContainer 
          center={[7.8731, 80.7718]} 
          zoom={7} 
          className="h-full w-full"
          scrollWheelZoom={true}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapEvents onMapClick={handleMapClick} />
          {points.length > 0 && points.map((p, i) => (
            <Marker key={i} position={p} icon={new L.DivIcon({
              className: 'custom-div-icon',
              html: `<div class="w-4 h-4 ${isConfirmed ? 'bg-success-600' : 'bg-primary-600'} rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] text-white font-bold transition-colors">${i + 1}</div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })} />
          ))}
          {points.length >= 2 && (
            <Polygon positions={points} pathOptions={{ 
              color: isConfirmed ? '#059669' : '#10b981', 
              fillColor: isConfirmed ? '#059669' : '#10b981', 
              fillOpacity: isConfirmed ? 0.3 : 0.2,
              weight: isConfirmed ? 4 : 3,
              dashArray: isConfirmed ? '' : '5, 10'
            }} />
          )}
          <MapController points={points} />
        </MapContainer>

        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          {!isConfirmed && (
            <button 
              type="button"
              onClick={handleUndo}
              disabled={points.length === 0}
              className="p-3 bg-white border border-slate-200 rounded-xl shadow-xl text-slate-600 hover:text-primary-600 transition-all disabled:opacity-50 active:scale-95"
              title="Undo Last Point"
            >
              <Undo size={20} />
            </button>
          )}
          <button 
            type="button"
            onClick={handleClear}
            disabled={points.length === 0}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-xl text-slate-600 hover:text-danger-600 transition-all disabled:opacity-50 active:scale-95"
            title="Clear Area"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-[1000] flex justify-center pointer-events-none">
           <div className={`bg-slate-900/90 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 border border-white/10 shadow-2xl transition-all ${isConfirmed ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              <HelpCircle size={14} className="text-primary-400" />
              {points.length < 3 
                ? `Click ${3 - points.length} more points to define patrol boundary`
                : 'Continue adding points or click Confirm to finish'}
           </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={points.length < 3 || isConfirmed}
          className={`flex-1 btn ${isConfirmed ? 'bg-success-600 text-white' : 'btn-primary'} py-4 text-xs uppercase tracking-widest font-bold shadow-lg shadow-primary-200 disabled:opacity-50 transition-all active:scale-[0.98]`}
        >
          {isConfirmed ? (
            <>
              <CheckCircle size={18} />
              Patrol Area Boundary Confirmed
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Confirm Patrol Area Boundary
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PatrolAreaSelector;
