import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Search, Phone, MapPin, Trash2, Edit2, User, 
  CheckCircle, X, Shield, Activity, Map as MapIcon, 
  Navigation, Send, RefreshCw, Info, Zap
} from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';

const MapEvents = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    telegramChatId: '',
    village: '',
    latitude: 7.8731,
    longitude: 80.7718,
    areaName: '',
    geofenceRadiusMeters: 1000,
    notificationEnabled: true
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (error) {
      toast.error('Failed to sync resident database');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isEditing) {
        await api.put(`/users/${currentUser._id}`, formData);
        toast.success('Resident node updated successfully');
      } else {
        await api.post('/users', formData);
        toast.success('Resident node registered successfully');
      }
      setShowModal(false);
      resetForm();
      await fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transaction failed');
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Decommission this resident node? This will terminate their alert relay.')) {
      try {
        await api.delete(`/users/${id}`);
        toast.success('Node decommissioned');
        fetchUsers();
      } catch (error) {
        toast.error('Decommissioning failed');
      }
    }
  };

  const handleEdit = (user) => {
    setIsEditing(true);
    setCurrentUser(user);
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
      telegramChatId: user.telegramChatId || '',
      village: user.village || '',
      latitude: user.areaLocation?.coordinates?.[1] || 7.8731,
      longitude: user.areaLocation?.coordinates?.[0] || 80.7718,
      areaName: user.areaLocation?.areaName || '',
      geofenceRadiusMeters: user.geofenceRadiusMeters || 1000,
      notificationEnabled: user.notificationEnabled !== undefined ? user.notificationEnabled : true
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      telegramChatId: '',
      village: '',
      latitude: 7.8731,
      longitude: 80.7718,
      areaName: '',
      geofenceRadiusMeters: 1000,
      notificationEnabled: true
    });
    setIsEditing(false);
    setCurrentUser(null);
  };

  const filteredUsers = Array.isArray(users) ? users.filter(user => {
    const s = searchTerm.toLowerCase();
    return String(user.name || '').toLowerCase().includes(s) || 
           String(user.village || '').toLowerCase().includes(s) || 
           String(user.phone || '').toLowerCase().includes(s);
  }) : [];

  return (
    <div className="space-y-[22px] pb-12 page-fade-in max-w-[1920px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight">
             Lanka Beacon <span className="text-[#1768d1]">Resident Network</span>
          </h1>
          <p className="text-[#64748b] text-[11px] font-[700] mt-1.5 uppercase tracking-widest">Manage community geofence nodes and notification relays</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="h-11 px-8 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#0f56b3] transition-all shadow-xl shadow-[#1768d1]/10"
        >
          <UserPlus size={16} />
          Register New Node
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[14px]">
        <div className="lg:col-span-8 space-y-[14px]">
           <div className="card p-3 flex items-center gap-3 border-[#dfe7f1]">
              <div className="relative flex-1">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1]" size={18} />
                 <input 
                   type="text" 
                   placeholder="Search community nodes by name, village or contact..." 
                   className="h-11 pl-12 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
              <div className="hidden md:flex items-center gap-5 px-5 border-l border-[#edf1f6]">
                 <div className="text-right">
                    <p className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest">Active Nodes</p>
                    <p className="text-[16px] font-[800] text-[#0f172a] leading-none">{filteredUsers.length}</p>
                 </div>
                 <div className="w-10 h-10 bg-[#f4f8ff] rounded-[5px] flex items-center justify-center text-[#1768d1] border border-[#eaf2ff]">
                    <Shield size={20} />
                 </div>
              </div>
           </div>

           <div className="card border-[#dfe7f1] overflow-hidden bg-white">
              <div className="overflow-x-auto">
                 {isLoading ? (
                    <div className="py-32 flex flex-col items-center justify-center space-y-5 opacity-40">
                       <RefreshCw size={40} className="animate-spin text-[#1768d1]" />
                       <p className="text-[11px] font-[800] uppercase tracking-widest text-[#64748b]">Syncing Community Matrix...</p>
                    </div>
                 ) : filteredUsers.length === 0 ? (
                    <div className="py-32 text-center space-y-5 opacity-40">
                       <div className="w-16 h-16 rounded-[5px] border-2 border-dashed border-[#cbd5e1] flex items-center justify-center text-[#cbd5e1] mx-auto">
                          <Search size={32} />
                       </div>
                       <p className="text-[11px] font-[800] uppercase tracking-widest text-[#64748b]">No active nodes found</p>
                    </div>
                 ) : (
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-[#f8fafc] border-b border-[#dfe7f1]">
                             <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest">Node Identity</th>
                             <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest">Location Matrix</th>
                             <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest text-center">Status</th>
                             <th className="px-6 py-[18px] text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest text-right">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[#edf1f6]">
                          {filteredUsers.map((resident) => (
                             <tr key={resident._id} className="hover:bg-[#f8fafc]/60 transition-colors group">
                                <td className="px-6 py-5">
                                   <div className="flex items-center gap-4">
                                      <div className="w-11 h-11 rounded-[5px] bg-[#f1f5f9] flex items-center justify-center text-[#94a3b8] group-hover:bg-[#eaf2ff] group-hover:text-[#1768d1] transition-colors border border-[#dfe7f1] shadow-sm">
                                         <User size={20} />
                                      </div>
                                      <div>
                                         <p className="font-[700] text-[#0f172a] text-[14px] tracking-tight group-hover:text-[#1768d1] transition-colors leading-none">{resident.name}</p>
                                         <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] text-[#64748b] font-[700] uppercase tracking-wider">{resident.phone}</span>
                                            {resident.telegramChatId && (
                                              <span className="text-[10px] text-[#1768d1] font-[800] uppercase tracking-widest border-l border-[#edf1f6] pl-2">ID: {resident.telegramChatId}</span>
                                            )}
                                         </div>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-5">
                                   <p className="text-[13px] font-[700] text-[#334155] leading-none">{resident.village}</p>
                                   <div className="flex items-center gap-2 mt-2 opacity-70">
                                      <Navigation size={10} className="text-[#64748b]" />
                                      <span className="text-[10.5px] font-[600] text-[#64748b] uppercase tracking-wider">
                                         {resident.geofenceRadiusMeters}M Geofence
                                      </span>
                                   </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                   <span className={`badge mx-auto px-3 py-1 font-[800] text-[10px] tracking-widest ${resident.notificationEnabled ? 'badge-success bg-[#edfcf4] text-[#0e7a42] border-[#b7efcf]' : 'badge-slate bg-[#f1f5f9] text-[#64748b] border-[#dbe4ef]'} rounded-[5px]`}>
                                      {resident.notificationEnabled ? 'ARMED' : 'MUTED'}
                                   </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                   <div className="flex items-center justify-end gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => handleEdit(resident)}
                                        className="w-9 h-9 flex items-center justify-center text-[#cbd5e1] hover:text-[#1768d1] hover:bg-[#eaf2ff] rounded-[5px] transition-all border border-transparent hover:border-[#b7efcf]"
                                        title="Configure Node"
                                      >
                                         <Edit2 size={16} />
                                      </button>
                                      <button 
                                        onClick={() => handleDelete(resident._id)}
                                        className="w-9 h-9 flex items-center justify-center text-[#cbd5e1] hover:text-[#e02424] hover:bg-[#fff1f1] rounded-[5px] transition-all border border-transparent hover:border-[#facaca]"
                                        title="Decommission Node"
                                      >
                                         <Trash2 size={16} />
                                      </button>
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 )}
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-[14px]">
           <div className="card p-6 bg-[#0b2d63] text-white relative overflow-hidden group border-none">
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/10 rounded-[5px] flex items-center justify-center border border-white/10 shadow-lg">
                       <Zap size={22} className="text-[#f59e0b]" />
                    </div>
                    <h3 className="font-[800] text-[11px] uppercase tracking-[0.2em]">Network Intelligence</h3>
                 </div>
                 <p className="text-[12.5px] text-[#eaf2ff]/80 font-[500] leading-relaxed uppercase tracking-wider">
                    Community nodes are prioritized by biological signature proximity. Notifications are dispatched via the high-priority Telegram Relay mesh.
                 </p>
                 <div className="pt-2 flex items-baseline gap-3 border-t border-white/10 mt-6 pt-6">
                    <span className="text-[36px] font-[800] leading-none tracking-tighter">{users.length}</span>
                    <span className="text-[10px] font-[800] text-[#2878e8] uppercase tracking-[0.2em]">Operational Nodes</span>
                 </div>
              </div>
              <Shield className="absolute -right-8 -bottom-8 text-white/5 transition-transform duration-1000 group-hover:scale-110" size={180} />
           </div>

           <div className="card p-6 space-y-5 border-[#dfe7f1] bg-white">
              <h3 className="text-[11px] font-[800] text-[#0f172a] uppercase tracking-[0.2em] flex items-center gap-2.5">
                 <Info size={16} className="text-[#1768d1]" />
                 Registration Protocol
              </h3>
              <ul className="space-y-4">
                 {[
                   'Acquire community Telegram Chat ID',
                   'Verify GPS telemetry on site',
                   'Configure adaptive geofence radius',
                   'Sync node with local sector mesh'
                 ].map((step, i) => (
                   <li key={i} className="flex items-start gap-4 text-[12.5px] font-[600] text-[#64748b]">
                      <div className="w-6 h-6 rounded-[5px] bg-[#f8fafc] flex items-center justify-center text-[11px] font-[800] text-[#1768d1] shrink-0 border border-[#dfe7f1] shadow-sm">
                         {i + 1}
                      </div>
                      <span className="mt-1 leading-tight uppercase tracking-tight">{step}</span>
                   </li>
                 ))}
              </ul>
           </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0f172a]/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-[5px] shadow-2xl border border-[#dfe7f1] animate-in zoom-in-95 duration-300 custom-scrollbar flex flex-col">
            <div className="sticky top-0 z-10 bg-[#f8fafc] border-b border-[#dfe7f1] px-8 py-6 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[20px] font-[800] text-[#0f172a] tracking-tight uppercase">
                   {isEditing ? 'Configure' : 'Register'} <span className="text-[#1768d1]">Resident Node</span>
                </h2>
                <p className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] mt-1.5 leading-none">Lanka Beacon Network Registration Protocol</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center hover:bg-[#f1f5f9] text-[#64748b] rounded-[5px] transition-colors border border-[#dfe7f1]">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div className="space-y-5">
                   <h3 className="text-[10.5px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] border-l-[3px] border-[#1768d1] pl-3">Identity Matrix</h3>
                   <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest mb-2 block">Full Legal Name</label>
                        <input type="text" className="h-11 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                           <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest mb-2 block">Contact Number</label>
                           <input type="text" className="h-11 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                         </div>
                         <div>
                           <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest mb-2 block">Telegram ID</label>
                           <input type="text" className="h-11 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" value={formData.telegramChatId} onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })} />
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-5">
                   <h3 className="text-[10.5px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] border-l-[3px] border-[#f59e0b] pl-3">Operational Boundaries</h3>
                   <div className="space-y-4">
                      <div>
                        <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest mb-2 block">Village / Sector Designation</label>
                        <input type="text" className="h-11 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" value={formData.village} onChange={(e) => setFormData({ ...formData, village: e.target.value })} required />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                           <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest">Geofence Radius</label>
                           <span className="text-[11px] font-[800] text-[#1768d1] uppercase">{formData.geofenceRadiusMeters} Meters</span>
                        </div>
                        <input 
                          type="range" 
                          min="500" 
                          max="5000" 
                          step="500"
                          className="w-full h-1.5 bg-[#f1f5f9] rounded-lg appearance-none cursor-pointer accent-[#1768d1]"
                          value={formData.geofenceRadiusMeters}
                          onChange={(e) => setFormData({ ...formData, geofenceRadiusMeters: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-[#f8fafc] rounded-[5px] border border-[#dfe7f1] shadow-sm">
                         <div>
                            <p className="text-[12px] font-[800] text-[#0f172a] uppercase leading-none">Alert Transmission</p>
                            <p className="text-[9px] text-[#94a3b8] font-[800] uppercase mt-2 tracking-widest">Operational State</p>
                         </div>
                         <button 
                           type="button"
                           onClick={() => setFormData({ ...formData, notificationEnabled: !formData.notificationEnabled })}
                           className={`w-12 h-6 rounded-full transition-colors relative shadow-inner ${formData.notificationEnabled ? 'bg-[#119c55]' : 'bg-[#cbd5e1]'}`}
                         >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${formData.notificationEnabled ? 'left-7' : 'left-1'}`}></div>
                         </button>
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-5">
                   <h3 className="text-[10.5px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] border-l-[3px] border-[#1768d1] pl-3">Geospatial Telemetry</h3>
                   <div className="space-y-4">
                      <div className="h-[280px] rounded-[5px] border border-[#dfe7f1] overflow-hidden relative shadow-md bg-[#f1f5f9]">
                         <MapContainer center={[formData.latitude, formData.longitude]} zoom={13} className="h-full w-full z-0">
                            <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png" />
                            <MapEvents onLocationSelect={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })} />
                            <Marker position={[formData.latitude, formData.longitude]} />
                            <Circle center={[formData.latitude, formData.longitude]} radius={formData.geofenceRadiusMeters} pathOptions={{ color: '#1768d1', fillColor: '#1768d1', fillOpacity: 0.1, weight: 2 }} />
                         </MapContainer>
                         <div className="absolute top-4 left-4 z-[500] px-3 py-1.5 bg-[#0f172a]/95 text-white rounded-[5px] text-[9px] font-[800] uppercase tracking-widest border border-white/10 shadow-2xl flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-[#18b866] rounded-full animate-pulse shadow-[0_0_5px_rgba(24,184,102,0.8)]"></div>
                            Tactical Matrix
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest mb-2 block">Latitude</label>
                            <input type="text" className="h-10 px-4 w-full bg-[#f8fafc] border border-[#dfe7f1] rounded-[5px] text-[11px] font-mono font-[700] text-[#475569]" value={formData.latitude.toFixed(6)} readOnly />
                         </div>
                         <div>
                            <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest mb-2 block">Longitude</label>
                            <input type="text" className="h-10 px-4 w-full bg-[#f8fafc] border border-[#dfe7f1] rounded-[5px] text-[11px] font-mono font-[700] text-[#475569]" value={formData.longitude.toFixed(6)} readOnly />
                         </div>
                      </div>
                   </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 h-12 bg-white text-[#475569] border border-[#dfe7f1] rounded-[5px] font-[800] text-[11px] uppercase tracking-widest hover:bg-[#f8fafc] transition-all">Abort</button>
                  <button type="submit" className="flex-[2] h-12 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[11px] uppercase tracking-widest shadow-xl shadow-[#1768d1]/10 hover:bg-[#0f56b3] transition-all flex items-center justify-center gap-3">
                     <CheckCircle size={18} />
                     {isEditing ? 'Update Node Intelligence' : 'Establish Network Node'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;