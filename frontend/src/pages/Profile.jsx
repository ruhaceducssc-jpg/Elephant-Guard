import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Shield, MapPin, Save, Lock, Send, Phone, 
  Globe, Clock, Bell, Settings, Eye, EyeOff, Activity, 
  Monitor, LogOut, ShieldAlert, Heart, ChevronRight,
  Camera, CheckCircle, AlertTriangle, Smartphone, Volume2, 
  Zap, Moon, RefreshCw, Navigation, Key, Map as MapIcon
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import PatrolAreaSelector from '../components/map/PatrolAreaSelector';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isSecurityKeyLoading, setIsSecurityKeyLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showSecurityKey, setShowSecurityKey] = useState(false);
  
  const [fullProfile, setFullProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    assignedArea: '',
    telegramChatId: '',
    language: 'English',
    timezone: 'Asia/Colombo',
    avatar: '',
    patrolArea: null,
    notificationPreferences: {
      telegramEnabled: true,
      emailEnabled: true,
      browserEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '06:00'
    },
    patrolSettings: {
      defaultGeofenceRadius: 1000,
      mapZoom: 13,
      focusArea: ''
    },
    emergencyContact: {
      name: '',
      phone: '',
      stationName: ''
    }
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [securityKeyData, setSecurityKeyData] = useState({
    securityKey: '',
    confirmSecurityKey: '',
    password: ''
  });

  // Safety date formatter
  const safeFormat = (date, formatStr) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return isValid(d) ? format(d, formatStr) : 'N/A';
  };

  const fetchFullProfile = async () => {
    try {
      const { data } = await api.get('/guards/me');
      setFullProfile(data);
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        assignedArea: data.assignedArea || '',
        telegramChatId: data.telegramChatId || '',
        language: data.language || 'English',
        timezone: data.timezone || 'Asia/Colombo',
        avatar: data.avatar || '',
        patrolArea: data.patrolArea || null,
        notificationPreferences: data.notificationPreferences || formData.notificationPreferences,
        quietHours: data.quietHours || formData.quietHours,
        patrolSettings: data.patrolSettings || formData.patrolSettings,
        emergencyContact: data.emergencyContact || formData.emergencyContact
      });
    } catch (error) {
      toast.error('Failed to retrieve profile');
    }
  };

  useEffect(() => {
    fetchFullProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: val
        }
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        [name]: val 
      }));
    }
  };

  const handleAreaSave = (polygon) => {
    setFormData(prev => ({ ...prev, patrolArea: polygon }));
    toast.success('Patrol boundary defined. Click Save to synchronize.');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    try {
      const data = await updateProfile(formData);
      setFullProfile(data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      return toast.error('Please fill all password fields');
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setIsPasswordLoading(true);
    try {
      await api.put('/guards/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      fetchFullProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleSecurityKeySubmit = async (e) => {
    e.preventDefault();
    if (!securityKeyData.securityKey || !securityKeyData.password) {
      return toast.error('Validation required');
    }
    if (securityKeyData.securityKey !== securityKeyData.confirmSecurityKey) {
      return toast.error('Recovery keys do not match');
    }

    setIsSecurityKeyLoading(true);
    try {
      await api.post('/guards/security-key', {
        securityKey: securityKeyData.securityKey,
        password: securityKeyData.password
      });
      toast.success('Security key established');
      setSecurityKeyData({ securityKey: '', confirmSecurityKey: '', password: '' });
      fetchFullProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving key');
    } finally {
      setIsSecurityKeyLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    toast.promise(
      api.post('/guards/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }),
      {
        loading: 'Uploading photo...',
        success: (res) => {
          setFullProfile(prev => ({ ...prev, avatar: res.data.avatar }));
          updateProfile({ ...fullProfile, avatar: res.data.avatar });
          return 'Profile photo updated';
        },
        error: 'Upload failed'
      }
    );
  };

  if (!fullProfile) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 page-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Officer <span className="text-primary-600">Profile</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage your account settings and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-success-50 text-success-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-success-100 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-success-600 rounded-full animate-pulse"></div>
            Authenticated
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Officer Card & Navigation */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-soft overflow-hidden group">
            <div className="h-28 bg-slate-50 relative overflow-hidden">
               <ShieldAlert className="absolute -right-6 -bottom-6 text-slate-200/50" size={160} />
               <div className="absolute inset-0 bg-primary-600/[0.03]"></div>
            </div>
            <div className="px-8 pb-10 -mt-12 relative z-10 text-center">
              <div className="relative inline-block mb-4">
                 <div className="w-24 h-24 bg-white rounded-3xl p-1 shadow-premium overflow-hidden border border-slate-100">
                    {fullProfile.avatar ? (
                      <img 
                        src={fullProfile.avatar.startsWith('http') ? fullProfile.avatar : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${fullProfile.avatar}`} 
                        alt="Profile" 
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary-600 text-white rounded-2xl flex items-center justify-center font-bold text-3xl uppercase tracking-tighter">
                        {fullProfile.name?.charAt(0)}
                      </div>
                    )}
                 </div>
                 <label className="absolute bottom-0 right-0 w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-primary-600 transition-all cursor-pointer shadow-lg border-2 border-white active:scale-90">
                    <Camera size={14} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                 </label>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{fullProfile.name}</h2>
              <p className="text-[10px] text-primary-600 font-bold uppercase tracking-widest mt-2">{fullProfile.role}</p>
              
              <div className="mt-8 space-y-2">
                 {[
                   { icon: <Shield />, label: 'Officer ID', value: (fullProfile._id || '').slice(-8).toUpperCase() },
                   { icon: <MapPin />, label: 'Active Sector', value: fullProfile.assignedArea },
                   { icon: <Send />, label: 'Telegram', value: fullProfile.telegramChatId ? 'Connected' : 'Not Linked', color: fullProfile.telegramChatId ? 'text-success-600' : 'text-slate-400' },
                 ].map((item, i) => (
                   <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100/50">
                      <div className="flex items-center gap-3">
                         <div className="text-slate-400">{React.cloneElement(item.icon, { size: 14 })}</div>
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${item.color || 'text-slate-700'} uppercase tracking-tight`}>{item.value}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-soft space-y-1">
            {[
              { id: 'general', label: 'Account Settings', icon: <User /> },
              { id: 'security', label: 'Security & Access', icon: <Lock /> },
              { id: 'patrol', label: 'Patrol Boundary', icon: <MapIcon /> },
              { id: 'notifications', label: 'Notifications', icon: <Bell /> },
              { id: 'monitoring', label: 'Monitoring Prefs', icon: <Navigation size={18} /> },
              { id: 'emergency', label: 'Emergency Info', icon: <Heart /> },
              { id: 'activity', label: 'Activity History', icon: <Activity /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-primary-50 text-primary-700 font-bold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${activeTab === tab.id ? 'text-primary-600' : 'text-slate-400'}`}>
                    {React.cloneElement(tab.icon, { size: 18 })}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest">{tab.label}</span>
                </div>
                <ChevronRight size={14} className={activeTab === tab.id ? 'opacity-100' : 'opacity-20'} />
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Tab Content */}
        <div className="lg:col-span-8">
           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-soft min-h-[700px] flex flex-col overflow-hidden">
                <div className="p-10 space-y-10 flex-1">
                  {/* General Info Tab */}
                  {activeTab === 'general' && (
                    <form onSubmit={handleSubmit} className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div>
                        <div className="flex items-center gap-4 mb-8 px-1">
                           <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center border border-primary-100">
                              <User size={20} />
                           </div>
                           <div>
                              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Account Information</h3>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Update your personal details and contact info</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-1.5">
                             <label className="label ml-1">Full Name</label>
                             <input type="text" name="name" value={formData.name} onChange={handleChange} className="input" />
                           </div>
                           <div className="space-y-1.5">
                             <label className="label ml-1">Email Address</label>
                             <input type="email" name="email" value={formData.email} onChange={handleChange} className="input" />
                           </div>
                           <div className="space-y-1.5">
                             <label className="label ml-1">Phone Number</label>
                             <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="+94 XX XXX XXXX" className="input" />
                           </div>
                           <div className="space-y-1.5">
                             <label className="label ml-1">Assigned Sector</label>
                             <input type="text" name="assignedArea" value={formData.assignedArea} onChange={handleChange} className="input" />
                           </div>
                           <div className="space-y-1.5 md:col-span-2">
                             <label className="label ml-1">Telegram Chat ID</label>
                             <div className="relative">
                               <Send className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                               <input type="text" name="telegramChatId" value={formData.telegramChatId} onChange={handleChange} className="input pl-11" />
                             </div>
                           </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-slate-100">
                         <div className="space-y-1.5">
                            <label className="label ml-1">System Language</label>
                            <select name="language" value={formData.language} onChange={handleChange} className="input appearance-none bg-slate-50/50">
                               <option>English</option>
                               <option>Sinhala</option>
                               <option>Tamil</option>
                            </select>
                         </div>
                         <div className="space-y-1.5">
                            <label className="label ml-1">Time Zone</label>
                            <select name="timezone" value={formData.timezone} onChange={handleChange} className="input appearance-none bg-slate-50/50">
                               <option value="Asia/Colombo">Asia/Colombo (GMT+5:30)</option>
                               <option value="UTC">UTC (GMT+0:00)</option>
                            </select>
                         </div>
                      </div>

                      <div className="pt-6 flex justify-end">
                        <button type="submit" disabled={isLoading} className="btn btn-primary px-8 py-3 text-xs uppercase tracking-widest font-bold">
                          {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                          Save Changes
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Patrol Area Tab */}
                  {activeTab === 'patrol' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className="flex items-center gap-4 mb-2 px-1">
                          <div className="w-10 h-10 bg-success-50 text-success-600 rounded-xl flex items-center justify-center border border-success-100">
                             <MapIcon size={20} />
                          </div>
                          <div>
                             <h3 className="text-lg font-bold text-slate-900 tracking-tight">Patrol Boundary</h3>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Define your assigned geographic responsibility zone</p>
                          </div>
                       </div>
                       
                       <PatrolAreaSelector 
                         initialPolygon={formData.patrolArea} 
                         onSave={handleAreaSave} 
                       />

                       <div className="pt-6 flex justify-end">
                        <button type="button" onClick={handleSubmit} disabled={isLoading || !formData.patrolArea} className="btn btn-primary px-8 py-3 text-xs uppercase tracking-widest font-bold">
                          {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                          Save Patrol Boundary
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Security Tab */}
                  {activeTab === 'security' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div>
                        <div className="flex items-center gap-4 mb-8 px-1">
                           <div className="w-10 h-10 bg-danger-50 text-danger-600 rounded-xl flex items-center justify-center border border-danger-100">
                              <Lock size={20} />
                           </div>
                           <div>
                              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Security Protocol</h3>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Update your password and recovery keys</p>
                           </div>
                        </div>
                        
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-4 mb-8">
                           <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                           <p className="text-xs text-amber-800 font-medium leading-relaxed uppercase tracking-tight">
                              Regular password rotation is recommended. Last change: {safeFormat(fullProfile.lastPasswordChange || fullProfile.createdAt, 'PPPP')}
                           </p>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                           <div className="space-y-1.5">
                             <label className="label ml-1">Current Password</label>
                             <div className="relative">
                               <input type={showPassword ? 'text' : 'password'} value={passwordData.currentPassword} onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})} className="input" />
                               <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600 transition-colors">
                                 {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                               </button>
                             </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1.5">
                                <label className="label ml-1">New Password</label>
                                <div className="relative">
                                  <input type={showNewPassword ? 'text' : 'password'} value={passwordData.newPassword} onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})} className="input" />
                                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600">
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="label ml-1">Confirm New Password</label>
                                <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})} className="input" />
                              </div>
                           </div>

                           <button type="submit" disabled={isPasswordLoading} className="btn btn-primary px-8 py-3 text-xs uppercase tracking-widest font-bold">
                              {isPasswordLoading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} />}
                              Update Password
                           </button>
                        </form>
                      </div>

                      <div className="pt-10 border-t border-slate-100">
                        <div className="flex items-center gap-4 mb-8 px-1">
                           <div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center border border-slate-100">
                              <Key size={20} />
                           </div>
                           <div>
                              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Recovery Key</h3>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Secondary access method for emergencies</p>
                           </div>
                        </div>

                        <form onSubmit={handleSecurityKeySubmit} className="space-y-6">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1.5">
                                <label className="label ml-1">Establish Security Phrase</label>
                                <div className="relative">
                                  <input type={showSecurityKey ? 'text' : 'password'} value={securityKeyData.securityKey} onChange={(e) => setSecurityKeyData({...securityKeyData, securityKey: e.target.value})} className="input" />
                                  <button type="button" onClick={() => setShowSecurityKey(!showSecurityKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600">
                                    {showSecurityKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="label ml-1">Verify Phrase</label>
                                <input type="password" value={securityKeyData.confirmSecurityKey} onChange={(e) => setSecurityKeyData({...securityKeyData, confirmSecurityKey: e.target.value})} className="input" />
                              </div>
                           </div>

                           <div className="space-y-1.5">
                             <label className="label ml-1">Authorize with Current Password</label>
                             <input type="password" value={securityKeyData.password} onChange={(e) => setSecurityKeyData({...securityKeyData, password: e.target.value})} placeholder="Validate identity" className="input" />
                           </div>

                           <button type="submit" disabled={isSecurityKeyLoading} className="btn btn-secondary px-8 py-3 text-xs uppercase tracking-widest font-bold border-slate-900 bg-slate-900 text-white hover:bg-black">
                              {isSecurityKeyLoading ? <RefreshCw className="animate-spin" size={16} /> : <Shield size={16} />}
                              Set Recovery Key
                           </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                   <div className="flex items-center gap-2">
                      <Shield size={14} className="text-primary-600" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End-to-End Encrypted Terminal</span>
                   </div>
                   <button type="button" onClick={() => fetchFullProfile()} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                      Reset View
                   </button>
                </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
