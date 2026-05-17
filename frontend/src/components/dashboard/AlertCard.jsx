import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, Send, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { format, isValid } from 'date-fns';

const AlertCard = ({ alert }) => {
  const navigate = useNavigate();
  
  const safeFormat = (date, formatStr) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : 'N/A';
  };

  const imageUrl = alert.image 
    ? (alert.image.startsWith('http') ? alert.image : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${alert.image}`) 
    : 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&q=80&w=400';

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'badge-danger';
      case 'cleared': return 'badge-success';
      default: return 'badge-primary';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft group hover:border-primary-100 transition-all duration-500">
      <div className="relative h-44 overflow-hidden">
        <img 
          src={imageUrl} 
          alt="Detection" 
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
        <div className="absolute top-4 right-4">
           <span className={`badge ${getStatusColor(alert.alertStatus)}`}>
             {alert.alertStatus || 'Tactical'}
           </span>
        </div>
        <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between text-white">
           <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary-200">Intelligence Node</p>
              <h4 className="font-bold text-lg tracking-tight truncate max-w-[200px]">
                {alert.locationName || alert.areaName}
              </h4>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Confidence</p>
              <p className="font-bold text-xl leading-none">{(alert.confidence * 100).toFixed(0)}%</p>
           </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-widest">
           <div className="flex items-center gap-2">
              <Clock size={14} className="text-primary-600" />
              {safeFormat(alert.detectedAt, 'HH:mm:ss')}
           </div>
           <div className="flex items-center gap-2">
              <Send size={14} className="text-primary-600" />
              {alert.notificationStatus === 'sent' ? 'Relay Active' : 'Relay Pending'}
           </div>
        </div>

        <button 
          onClick={() => navigate(`/dashboard/map/${alert.id || alert._id}`)}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-700 transition-all duration-300 shadow-lg shadow-primary-200 flex items-center justify-center gap-2 active:scale-95"
        >
          <ShieldAlert size={16} />
          View on Map
        </button>
      </div>
    </div>
  );
};

export default AlertCard;
