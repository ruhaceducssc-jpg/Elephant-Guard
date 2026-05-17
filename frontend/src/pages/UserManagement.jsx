import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Phone, MapPin, Trash2, Edit2, User, CheckCircle, X, Shield, Activity, Map as MapIcon, Navigation, Send } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

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
    latitude: '',
    longitude: '',
    areaName: '',
    geofenceRadiusMeters: 1000,
    notificationEnabled: true
  });

  const fetchUsers = async () => {
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isEditing) {
        if (!currentUser || !currentUser._id) {
          toast.error('Session expired or invalid selection');
          setIsLoading(false);
          return;
        }
        await api.put(`/users/${currentUser._id}`, formData);
        toast.success('Resident profile updated');
      } else {
        await api.post('/users', formData);
        toast.success('Resident registered successfully');
      }
      setShowModal(false);
      resetForm();
      await fetchUsers();
    } catch (error) {
      console.error('Transaction error:', error);
      toast.error(error.response?.data?.message || 'Transaction failed. Please check connection.');
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this resident record? This will disable their alert notifications.')) {
      try {
        await api.delete(`/users/${id}`);
        toast.success('Resident record removed');
        fetchUsers();
      } catch (error) {
        toast.error('Deletion failed');
      }
    }
  };

  const handleEdit = (user) => {
    if (!user) return;
    setIsEditing(true);
    setCurrentUser(user);
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
      telegramChatId: user.telegramChatId || '',
      village: user.village || '',
      latitude: user.areaLocation?.coordinates?.[1] || '',
      longitude: user.areaLocation?.coordinates?.[0] || '',
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
      latitude: '',
      longitude: '',
      areaName: '',
      geofenceRadiusMeters: 1000,
      notificationEnabled: true
    });
    setIsEditing(false);
    setCurrentUser(null);
  };

  const filteredUsers = Array.isArray(users) ? users.filter(user => 
    (user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user?.village || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user?.phone || '').includes(searchTerm)
  ) : [];

  return (
    <div className="space-y-10 pb-12 page-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
             <UserPlus className="text-primary-600" size={28} />
             Resident <span className="text-primary-600">Management</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage local geofence nodes and notification relays</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn btn-primary px-6 shadow-lg shadow-primary-200"
        >
          <UserPlus size={18} />
          Add Resident
        </button>
      </div>

      <div className="bg-white p-4 flex flex-col md:flex-row gap-4 items-center rounded-2xl border border-slate-200 shadow-soft">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, village, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-12"
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
           <Shield size={16} className="text-primary-600" />
           <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{users.length} Active Nodes</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center space-y-4">
             <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing Records...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-32 text-center space-y-5">
             <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center mx-auto border border-slate-100">
                <Activity size={32} />
             </div>
             <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No resident nodes found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resident Details</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Geofence</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Location</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relay</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => (
                  <tr key={user._id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary-600 group-hover:text-white transition-all shadow-inner">
                          <User size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm tracking-tight">{user.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">{user.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{user.geofenceRadiusMeters}M RADIUS</span>
                        <span className="text-[9px] text-primary-600 uppercase font-bold tracking-widest mt-0.5">Circular Protocol</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div>
                        <p className="text-xs font-bold text-slate-700">{user.village}</p>
                        <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-widest">
                          <Navigation size={10} /> {user.areaLocation?.areaName || 'Unknown'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`badge ${
                        user.notificationEnabled ? 'badge-success' : 'badge-danger opacity-60'
                      }`}>
                        {user.notificationEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(user)}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(user._id)}
                          className="p-2 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ResidentModal 
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          isEditing={isEditing}
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};

const ResidentModal = ({ isOpen, onClose, isEditing, formData, onChange, onSubmit }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-200">
        <div className="bg-slate-50 border-b border-slate-200 p-8 flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="relative z-10">
             <h2 className="text-xl font-bold text-slate-900 tracking-tight">{isEditing ? 'Edit Resident Node' : 'Register New Resident'}</h2>
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Configure alert relay parameters</p>
          </div>
          <Shield size={120} className="absolute -right-6 -bottom-6 text-slate-200/40" />
          <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-200 text-slate-400 rounded-xl transition-colors z-20">
             <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
          <form onSubmit={onSubmit} className="p-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                <input type="text" name="name" required value={formData.name} onChange={onChange} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Phone Number</label>
                <input type="text" name="phone" required value={formData.phone} onChange={onChange} className="input" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Telegram Chat ID</label>
                <input type="text" name="telegramChatId" required value={formData.telegramChatId} onChange={onChange} placeholder="e.g. 123456789" className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Geofence Radius (M)</label>
                <input type="number" name="geofenceRadiusMeters" required value={formData.geofenceRadiusMeters} onChange={onChange} min="100" max="10000" className="input" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Village Name</label>
                <input type="text" name="village" required value={formData.village} onChange={onChange} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Area Identifier</label>
                <input type="text" name="areaName" required value={formData.areaName} onChange={onChange} placeholder="e.g. SE-12" className="input" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Latitude</label>
                <input type="number" step="any" name="latitude" required value={formData.latitude} onChange={onChange} className="input" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Longitude</label>
                <input type="number" step="any" name="longitude" required value={formData.longitude} onChange={onChange} className="input" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary-600 shadow-sm border border-slate-100">
                    <Send size={18} />
                 </div>
                 <div>
                    <p className="text-xs font-bold text-slate-800 tracking-tight">Notification Relay</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Automated Telegram alerts</p>
                 </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="notificationEnabled" checked={formData.notificationEnabled} onChange={onChange} className="sr-only peer" />
                <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex gap-4 pt-2 pb-4">
              <button type="button" onClick={onClose} className="flex-1 btn btn-secondary py-3 text-xs uppercase tracking-widest font-bold">
                Cancel
              </button>
              <button type="submit" className="flex-1 btn btn-primary py-3 text-xs uppercase tracking-widest font-bold shadow-lg shadow-primary-200">
                {isEditing ? 'Update Node' : 'Save Resident'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
