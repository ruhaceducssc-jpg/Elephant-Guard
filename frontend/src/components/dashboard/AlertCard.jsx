import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, Send, CheckCircle, XCircle } from 'lucide-react';
import { format, isValid } from 'date-fns';

const AlertCard = ({ alert }) => {
  const navigate = useNavigate();
  
  const safeFormat = (date, formatStr) => {
    if (!date) return '--:--';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : '--:--';
  };

  const imageUrl = alert.image 
    ? `http://localhost:5000/uploads/${alert.image}` 
    : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&q=80&w=400';

  const lat = alert.latitude || (alert.coordinates ? alert.coordinates[1] : null);
  const lng = alert.longitude || (alert.coordinates ? alert.coordinates[0] : null);
  const locationName = alert.areaName || alert.locationName || 'Unknown Location';

  // Notification Status Helpers
  const getNotificationIcon = () => {
    switch(alert.notificationStatus) {
      case 'sent': return <CheckCircle size={14} className="text-green-500" />;
      case 'failed': return <XCircle size={14} className="text-red-500" />;
      case 'partial': return <Send size={14} className="text-amber-500" />;
      default: return <Clock size={14} className="text-gray-400" />;
    }
  };

  const getNotificationText = () => {
    if (!alert.notificationStatus || alert.notificationStatus === 'pending') return 'Broadcasting...';
    if (alert.notificationStatus === 'sent') return `Sent to ${alert.recipientCount || 0} users`;
    if (alert.notificationStatus === 'partial') return `Partial (${alert.recipientCount || 0} sent)`;
    return 'Broadcast Failed';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition">
      <div className="relative h-40">
        <img src={imageUrl} alt="Detection" className="w-full h-full object-cover" />
        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold uppercase ${
          alert.status === 'active' || alert.alertStatus === 'new' ? 'bg-red-600 text-white' : 'bg-gray-500 text-white'
        }`}>
          {alert.status || alert.alertStatus}
        </div>
        
        {/* Notification Status Overlay */}
        <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md py-1.5 px-3 rounded-lg flex items-center gap-2 border border-white/10">
          {getNotificationIcon()}
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">{getNotificationText()}</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-gray-800 leading-tight">Elephant Spotted</h3>
          <span className="text-xs text-primary-600 font-bold">{(alert.confidence * 100).toFixed(0)}% Match</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={16} />
            <span className="truncate">{locationName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={16} />
            <span>{safeFormat(alert.detectedAt, 'p')} • {safeFormat(alert.detectedAt, 'MMM dd')}</span>
          </div>
        </div>

        <button 
          onClick={() => navigate(`/dashboard/map/${alert.id || alert._id}`)}
          className="w-full mt-2 py-3 text-xs font-black uppercase tracking-widest text-white bg-gray-900 rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-200"
        >
          Inspect on Map
        </button>
      </div>
    </div>
  );
};

export default AlertCard;
