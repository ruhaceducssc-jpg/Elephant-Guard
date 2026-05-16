import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Shield, MapPin, Save, Lock, Send, Phone, 
  Globe, Clock, Bell, Settings, Eye, EyeOff, Activity, 
  Monitor, LogOut, ShieldAlert, Heart, ChevronRight,
  Camera, CheckCircle, AlertTriangle, Smartphone, Volume2, 
  Zap, Moon, RefreshCw, Navigation
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { format, isValid } from 'date-fns';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
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
        notificationPreferences: data.notificationPreferences || formData.notificationPreferences,
        quietHours: data.quietHours || formData.quietHours,
        patrolSettings: data.patrolSettings || formData.patrolSettings,
        emergencyContact: data.emergencyContact || formData.emergencyContact
      });
    } catch (error) {
      toast.error('Failed to load full profile');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await updateProfile(formData);
      setFullProfile(data);
      toast.success('Control Center updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setIsPasswordLoading(true);
    try {
      await api.put('/guards/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Security credentials updated');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Password update failed');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    toast.promise(
      api.post('/alerts/notifications/test', { chatId: formData.telegramChatId }),
      {
        loading: 'Sending test encrypted packet...',
        success: 'Telegram relay confirmed!',
        error: 'Failed to reach Telegram node'
      }
    );
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
        loading: 'Uploading secure biometric signature...',
        success: (res) => {
          setFullProfile(prev => ({ ...prev, avatar: res.data.avatar }));
          updateProfile({ ...fullProfile, avatar: res.data.avatar });
          return 'Avatar updated successfully!';
        },
        error: 'Upload failed'
      }
    );
  };

  if (!fullProfile) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">
            Guard <span className="text-primary-600">Account Center</span>
          </h1>
          <p className="text-gray-500 font-medium mt-1">Unified Command & Security Control for Officer {fullProfile.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary-100 flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
            System Auth Valid
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Summary Card & Navigation */}
        <div className="lg:col-span-4 space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden group">
            <div className="h-32 bg-primary-700 relative overflow-hidden">
               <ShieldAlert className="absolute -right-4 -bottom-4 text-white/10" size={160} />
            </div>
            <div className="px-8 pb-8 -mt-12 relative z-10 text-center">
              <div className="relative inline-block mb-4">
                 <div className="w-24 h-24 bg-white rounded-[2rem] p-1 shadow-2xl overflow-hidden">
                    {fullProfile.avatar ? (
                      <img 
                        src={`${import.meta.env.VITE_API_URL.replace('/api', '')}/uploads/${fullProfile.avatar}`} 
                        alt="Profile" 
                        className="w-full h-full object-cover rounded-[1.8rem]"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary-100 text-primary-700 rounded-[1.8rem] flex items-center justify-center font-black text-3xl uppercase tracking-tighter">
                        {fullProfile.name?.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                 </div>
                 <label className="absolute bottom-0 right-0 w-8 h-8 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-black transition-all cursor-pointer">
                    <Camera size={16} />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleAvatarUpload}
                    />
                 </label>
              </div>
              <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{fullProfile.name}</h2>
              <p className="text-xs text-primary-600 font-black uppercase tracking-[0.2em] mt-1">{fullProfile.role}</p>
              
              <div className="mt-8 space-y-3">
                 {[
                   { icon: <Shield />, label: 'Officer ID', value: (fullProfile._id || '').slice(-8).toUpperCase() },
                   { icon: <MapPin />, label: 'Assigned Zone', value: fullProfile.assignedArea },
                   { icon: <Send />, label: 'Telegram Node', value: fullProfile.telegramChatId ? 'Connected' : 'Unlinked', color: fullProfile.telegramChatId ? 'text-green-600' : 'text-red-500' },
                   { icon: <Clock />, label: 'Last Command', value: safeFormat(fullProfile.lastLogin, 'MMM dd, HH:mm') },
                 ].map((item, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 group-hover:bg-white transition-all">
                      <div className="flex items-center gap-3">
                         <div className="text-gray-400 group-hover:text-primary-600 transition-colors">{React.cloneElement(item.icon, { size: 16 })}</div>
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.label}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${item.color || 'text-gray-800'} uppercase tracking-tighter`}>{item.value}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white p-4 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-2">
            {[
              { id: 'general', label: 'Personal Intel', icon: <User /> },
              { id: 'security', label: 'Security Protocols', icon: <Lock /> },
              { id: 'notifications', label: 'Alert Preferences', icon: <Bell /> },
              { id: 'patrol', label: 'Patrol Parameters', icon: <Navigation size={18} /> },
              { id: 'emergency', label: 'Safety & Emergency', icon: <Heart /> },
              { id: 'activity', label: 'Activity Logs', icon: <Activity /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  activeTab === tab.id 
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-100' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`}>
                    {React.cloneElement(tab.icon, { size: 20 })}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
                </div>
                <ChevronRight size={16} className={activeTab === tab.id ? 'opacity-100' : 'opacity-20'} />
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Tab Content */}
        <div className="lg:col-span-8">
           <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm min-h-[700px] flex flex-col">
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                <div className="p-10 space-y-8 flex-1">
                  {/* General Info Tab */}
                  {activeTab === 'general' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div>
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                           <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                              <User size={20} />
                           </div>
                           Personal Identity Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Official Name</label>
                             <div className="relative">
                               <User className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type="text" 
                                 name="name"
                                 value={formData.name}
                                 onChange={handleChange}
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Command Email</label>
                             <div className="relative">
                               <Mail className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type="email" 
                                 name="email"
                                 value={formData.email}
                                 onChange={handleChange}
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Phone Link</label>
                             <div className="relative">
                               <Phone className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type="text" 
                                 name="phone"
                                 value={formData.phone}
                                 onChange={handleChange}
                                 placeholder="+94 XX XXX XXXX"
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Assigned Sector</label>
                             <div className="relative">
                               <MapPin className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type="text" 
                                 name="assignedArea"
                                 value={formData.assignedArea}
                                 onChange={handleChange}
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Telegram Chat ID</label>
                             <div className="relative">
                               <Send className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type="text" 
                                 name="telegramChatId"
                                 value={formData.telegramChatId}
                                 onChange={handleChange}
                                 placeholder="e.g. 123456789"
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                             </div>
                           </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">System Language</label>
                            <div className="relative">
                               <Globe className="absolute left-4 top-4 text-gray-400" size={18} />
                               <select 
                                 name="language"
                                 value={formData.language}
                                 onChange={handleChange}
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm appearance-none"
                               >
                                 <option>English</option>
                                 <option>Sinhala</option>
                                 <option>Tamil</option>
                               </select>
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Time Zone</label>
                            <div className="relative">
                               <Clock className="absolute left-4 top-4 text-gray-400" size={18} />
                               <select 
                                 name="timezone"
                                 value={formData.timezone}
                                 onChange={handleChange}
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm appearance-none"
                               >
                                 <option value="Asia/Colombo">Asia/Colombo (GMT+5:30)</option>
                                 <option value="UTC">UTC (GMT+0:00)</option>
                               </select>
                            </div>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* Security Tab */}
                  {activeTab === 'security' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div>
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                           <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                              <Lock size={20} />
                           </div>
                           Encryption & Security Credentials
                        </h3>
                        
                        <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4 mb-8">
                           <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                              <AlertTriangle size={24} />
                           </div>
                           <div>
                              <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Security Advisory</p>
                              <p className="text-xs text-amber-700 font-medium leading-relaxed mt-1">
                                Your last password change was {safeFormat(fullProfile.lastPasswordChange || fullProfile.createdAt, 'PPPP')}. We recommend rotating credentials every 90 days.
                              </p>
                           </div>
                        </div>

                        <div className="space-y-6">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Current System Password</label>
                             <div className="relative">
                               <Lock className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type={showPassword ? 'text' : 'password'} 
                                 value={passwordData.currentPassword}
                                 onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                                 className="w-full pl-12 pr-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                               <button 
                                 type="button"
                                 onClick={() => setShowPassword(!showPassword)}
                                 className="absolute right-4 top-4 text-gray-400 hover:text-primary-600 transition-colors"
                               >
                                 {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                               </button>
                             </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">New Security Key</label>
                                <div className="relative">
                                  <Shield className="absolute left-4 top-4 text-gray-400" size={18} />
                                  <input 
                                    type={showNewPassword ? 'text' : 'password'} 
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                                    className="w-full pl-12 pr-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-4 top-4 text-gray-400 hover:text-primary-600 transition-colors"
                                  >
                                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Verify New Key</label>
                                <div className="relative">
                                  <CheckCircle className="absolute left-4 top-4 text-gray-400" size={18} />
                                  <input 
                                    type="password" 
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                                    className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                                  />
                                </div>
                              </div>
                           </div>

                           <button 
                             type="button"
                             onClick={handlePasswordSubmit}
                             disabled={isPasswordLoading || !passwordData.newPassword}
                             className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center gap-3 disabled:opacity-50"
                           >
                              {isPasswordLoading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                              Update Credentials
                           </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notifications Tab */}
                  {activeTab === 'notifications' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div>
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                           <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                              <Bell size={20} />
                           </div>
                           Notification Delivery Protocols
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {[
                             { id: 'telegramEnabled', label: 'Telegram Secure Relay', icon: <Send />, desc: 'Real-time alerts via Telegram Bot' },
                             { id: 'emailEnabled', label: 'Email Intelligence Logs', icon: <Mail />, desc: 'Detailed hourly summary reports' },
                             { id: 'browserEnabled', label: 'Browser Push Notifications', icon: <Monitor />, desc: 'Instant desktop system alerts' },
                             { id: 'soundEnabled', label: 'Audible Alert Signal', icon: <Volume2 />, desc: 'Play specific sounds on detection' },
                             { id: 'vibrationEnabled', label: 'Haptic Mobile Feedback', icon: <Smartphone />, desc: 'Device vibration for priority alerts' },
                           ].map((pref) => (
                             <div key={pref.id} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 flex items-center justify-between group hover:bg-white transition-all">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                                      {React.cloneElement(pref.icon, { size: 18 })}
                                   </div>
                                   <div>
                                      <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{pref.label}</p>
                                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{pref.desc}</p>
                                   </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setFormData({
                                    ...formData,
                                    notificationPreferences: {
                                      ...formData.notificationPreferences,
                                      [pref.id]: !formData.notificationPreferences[pref.id]
                                    }
                                  })}
                                  className={`w-12 h-6 rounded-full transition-all relative ${formData.notificationPreferences[pref.id] ? 'bg-primary-600' : 'bg-gray-200'}`}
                                >
                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${formData.notificationPreferences[pref.id] ? 'left-7' : 'left-1'}`}></div>
                                </button>
                             </div>
                           ))}
                        </div>
                      </div>

                      <div className="pt-10 border-t border-gray-100">
                         <div className="flex items-center justify-between mb-6 px-2">
                           <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Quiet Hours Protocol</h4>
                           <button
                             type="button"
                             onClick={() => setFormData({
                               ...formData,
                               quietHours: { ...formData.quietHours, enabled: !formData.quietHours.enabled }
                             })}
                             className={`w-12 h-6 rounded-full transition-all relative ${formData.quietHours.enabled ? 'bg-gray-900' : 'bg-gray-200'}`}
                           >
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all ${formData.quietHours.enabled ? 'left-7' : 'left-1'}`}></div>
                           </button>
                         </div>

                         <div className={`grid grid-cols-2 gap-6 p-8 rounded-[2.5rem] border transition-all ${formData.quietHours.enabled ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                            <div className="space-y-2">
                               <label className={`text-[9px] font-black uppercase tracking-widest px-2 ${formData.quietHours.enabled ? 'text-gray-400' : 'text-gray-300'}`}>Protocol Start</label>
                               <div className="relative">
                                  <Moon className={`absolute left-4 top-4 ${formData.quietHours.enabled ? 'text-primary-500' : 'text-gray-300'}`} size={18} />
                                  <input 
                                    type="time" 
                                    disabled={!formData.quietHours.enabled}
                                    value={formData.quietHours.start}
                                    onChange={(e) => setFormData({...formData, quietHours: {...formData.quietHours, start: e.target.value}})}
                                    className={`w-full pl-12 pr-6 py-4 border-none rounded-2xl outline-none font-bold text-sm ${formData.quietHours.enabled ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-400'}`}
                                  />
                               </div>
                            </div>
                            <div className="space-y-2">
                               <label className={`text-[9px] font-black uppercase tracking-widest px-2 ${formData.quietHours.enabled ? 'text-gray-400' : 'text-gray-300'}`}>Protocol End</label>
                               <div className="relative">
                                  <Clock className={`absolute left-4 top-4 ${formData.quietHours.enabled ? 'text-primary-500' : 'text-gray-300'}`} size={18} />
                                  <input 
                                    type="time" 
                                    disabled={!formData.quietHours.enabled}
                                    value={formData.quietHours.end}
                                    onChange={(e) => setFormData({...formData, quietHours: {...formData.quietHours, end: e.target.value}})}
                                    className={`w-full pl-12 pr-6 py-4 border-none rounded-2xl outline-none font-bold text-sm ${formData.quietHours.enabled ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-400'}`}
                                  />
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="pt-10">
                         <button 
                           type="button"
                           onClick={handleTestTelegram}
                           className="w-full py-5 bg-primary-50 text-primary-700 rounded-[2rem] border border-primary-100 font-black text-xs uppercase tracking-[0.3em] hover:bg-primary-600 hover:text-white transition-all shadow-sm"
                         >
                           Run Telegram Connectivity Diagnostics
                         </button>
                      </div>
                    </div>
                  )}

                  {/* Patrol Tab */}
                  {activeTab === 'patrol' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div>
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                           <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                              <Navigation size={20} />
                           </div>
                           Geofencing & Patrol Sector Logic
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Primary Patrol Hub</label>
                              <div className="relative">
                                 <MapPin className="absolute left-4 top-4 text-gray-400" size={18} />
                                 <input 
                                   type="text" 
                                   name="patrolSettings.focusArea"
                                   value={formData.patrolSettings.focusArea}
                                   onChange={handleChange}
                                   placeholder="Main patrol station or village"
                                   className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                                 />
                              </div>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Default Geofence Radius (m)</label>
                              <div className="relative">
                                 <ShieldAlert className="absolute left-4 top-4 text-gray-400" size={18} />
                                 <input 
                                   type="number" 
                                   name="patrolSettings.defaultGeofenceRadius"
                                   value={formData.patrolSettings.defaultGeofenceRadius}
                                   onChange={handleChange}
                                   className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="bg-gray-50 rounded-[3rem] border border-gray-100 overflow-hidden h-[300px] relative">
                           <MapContainer 
                             center={[7.8731, 80.7718]} 
                             zoom={formData.patrolSettings.mapZoom || 13} 
                             scrollWheelZoom={false} 
                             className="h-full w-full" 
                             zoomControl={false}
                           >
                             <TileLayer
                               attribution='&copy; Stadia Maps'
                               url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                             />
                             <Circle 
                               center={[7.8731, 80.7718]} 
                               radius={formData.patrolSettings.defaultGeofenceRadius || 1000} 
                               pathOptions={{ fillColor: '#0ea5e9', color: '#0ea5e9', weight: 2, opacity: 0.6, fillOpacity: 0.1 }}
                             />
                           </MapContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Emergency Tab */}
                  {activeTab === 'emergency' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div>
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                           <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                              <Heart size={20} />
                           </div>
                           Emergency Escalation & Safety Nodes
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Backup Command Contact</label>
                             <div className="relative">
                               <User className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type="text" 
                                 name="emergencyContact.name"
                                 value={formData.emergencyContact.name}
                                 onChange={handleChange}
                                 placeholder="Secondary Officer Name"
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Emergency Direct Line</label>
                             <div className="relative">
                               <Phone className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type="text" 
                                 name="emergencyContact.phone"
                                 value={formData.emergencyContact.phone}
                                 onChange={handleChange}
                                 placeholder="Officer Phone Number"
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                             </div>
                           </div>
                           <div className="col-span-full space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Primary Command Station</label>
                             <div className="relative">
                               <ShieldAlert className="absolute left-4 top-4 text-gray-400" size={18} />
                               <input 
                                 type="text" 
                                 name="emergencyContact.stationName"
                                 value={formData.emergencyContact.stationName}
                                 onChange={handleChange}
                                 placeholder="Wildlife Office or Station Name"
                                 className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                               />
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity Tab */}
                  {activeTab === 'activity' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div>
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                           <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                              <Activity size={20} />
                           </div>
                           Operational Audit Log
                        </h3>

                        <div className="space-y-4">
                           {[
                             { action: 'Security credentials rotated', time: fullProfile.lastPasswordChange, icon: <Lock /> },
                             { action: 'Account access initialized', time: fullProfile.lastLogin, icon: <Monitor /> },
                             { action: 'Command center configuration updated', time: fullProfile.updatedAt, icon: <Settings /> },
                             { action: 'Officer profile instantiated', time: fullProfile.createdAt, icon: <User /> },
                           ].map((item, i) => (
                             <div key={i} className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 flex items-center justify-between group hover:bg-white transition-all">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 group-hover:text-primary-600 shadow-sm transition-colors">
                                      {item.icon}
                                   </div>
                                   <div>
                                      <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{item.action}</p>
                                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{safeFormat(item.time, 'PPPP p')}</p>
                                   </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                                   <CheckCircle size={14} />
                                </div>
                             </div>
                           ))}
                        </div>
                       </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-[3rem]">
                   <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Shield size={14} className="text-primary-600" />
                      Encrypted End-to-End Control Node
                   </div>
                   <div className="flex items-center gap-4">
                      <button 
                        type="button" 
                        onClick={() => fetchFullProfile()}
                        className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
                      >
                         Discard Session
                      </button>
                      <button 
                        type="submit"
                        disabled={isLoading}
                        className="px-10 py-4 bg-primary-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-primary-700 transition-all shadow-xl shadow-primary-100 flex items-center gap-3 disabled:opacity-50"
                      >
                         {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                         Deploy Configurations
                      </button>
                   </div>
                </div>
              </form>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
