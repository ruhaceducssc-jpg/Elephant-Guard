import React, { useState, useEffect } from 'react';
import {
  User, MapPin, Save, Lock, Send,
  Eye, EyeOff, ShieldAlert, ChevronRight,
  Camera, AlertTriangle, RefreshCw, Key, Map as MapIcon,
  Zap, X, CheckCircle, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { format, isValid } from 'date-fns';
import PatrolAreaSelector from '../components/map/PatrolAreaSelector';

const Profile = () => {
  const { updateProfile, syncUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('settings');
  const [isLoading, setIsLoading] = useState(false);
  const [isSecurityLoading, setIsSecurityLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [fullProfile, setFullProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    assignedArea: '',
    telegramChatId: '',
    patrolArea: null
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

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
        patrolArea: data.patrolArea || null
      });
    } catch (error) {
      toast.error('Failed to retrieve profile');
    }
  };

  useEffect(() => {
    fetchFullProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    try {
      const { patrolArea, ...profileFields } = formData;
      const data = await updateProfile(profileFields);
      toast.success('Profile updated successfully');
      setFullProfile(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    setIsLoading(true);
    try {
      await api.put('/guards/security', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Security password updated');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Password update failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('avatar', file);
    setIsUploading(true);

    try {
      const { data } = await api.post('/guards/avatar', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFullProfile(prev => ({ ...prev, avatar: data.avatar }));
      updateProfile({ ...fullProfile, avatar: data.avatar });
      toast.success('Profile avatar updated');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  if (!fullProfile) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
        <p className="text-[11px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em]">Synchronizing Secure Profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-[22px] pb-20 page-fade-in max-w-[1920px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="flex items-center gap-6">
           <div className="relative group">
              <div className="w-24 h-24 rounded-[5px] bg-[#f1f5f9] overflow-hidden border-2 border-white shadow-xl relative group-hover:border-[#1768d1] transition-all">
                 {fullProfile?.avatar ? (
                    <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${fullProfile.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#eaf2ff] text-[#1768d1] text-3xl font-[800]">
                       {fullProfile?.name?.charAt(0)}
                    </div>
                 )}
                 <label className="absolute inset-0 bg-[#0f172a]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera size={24} className="text-white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                 </label>
              </div>
           </div>
           <div className="space-y-1">
              <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight leading-none">
                 {fullProfile?.name}
              </h1>
              <div className="flex items-center gap-3">
                 <p className="text-[#64748b] text-[12px] font-[700] uppercase tracking-widest">Wildlife Enforcement Officer</p>
                 <span className="w-1 h-1 bg-[#cbd5e1] rounded-full"></span>
                 <p className="text-[#1768d1] text-[11px] font-[800] uppercase tracking-widest">{fullProfile?.assignedArea}</p>
              </div>
           </div>
        </div>
        <div className="badge badge-success px-5 py-2.5 bg-[#edfcf4] text-[#0e7a42] border-[#b7efcf] rounded-[5px] font-[800] text-[11px] tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-[#18b866] rounded-full animate-pulse"></div>
            AUTHENTICATED SESSION
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[14px]">
        {/* Sidebar / Tabs */}
        <div className="lg:col-span-3 space-y-[14px]">
           <div className="card p-2 flex flex-col gap-1 border-[#dfe7f1] bg-white">
              {[
                { id: 'settings', label: 'Account Settings', icon: <User size={18} /> },
                { id: 'security', label: 'Security & Access', icon: <Lock size={18} /> },
                { id: 'patrol', label: 'Patrol Boundary', icon: <MapIcon size={18} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-[5px] font-[700] text-[13.5px] transition-all border ${
                    activeTab === tab.id 
                      ? 'bg-[#1768d1] text-white border-[#1768d1] shadow-lg shadow-[#1768d1]/10' 
                      : 'text-[#64748b] border-transparent hover:bg-[#f8fafc] hover:text-[#0f172a]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              <div className="h-px bg-[#edf1f6] mx-3 my-1" />
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-[5px] font-[700] text-[13.5px] text-[#e02424] transition-all border border-transparent hover:bg-[#fff1f1] hover:border-[#facaca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e02424]/30"
              >
                <LogOut size={18} />
                Logout
              </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9">
           <div className="card h-full min-h-[600px] flex flex-col border-[#dfe7f1] bg-white">
              <div className="px-8 py-[22px] border-b border-[#dfe7f1] bg-[#f8fafc] flex items-center justify-between shrink-0">
                 <h2 className="text-[14px] font-[800] text-[#0f172a] uppercase tracking-widest flex items-center gap-3">
                    {activeTab === 'settings' && <><User className="text-[#1768d1]" size={20} /> Account Settings</>}
                    {activeTab === 'security' && <><Lock className="text-[#f59e0b]" size={20} /> Security & Access</>}
                    {activeTab === 'patrol' && <><MapIcon className="text-[#119c55]" size={20} /> Patrol Boundary</>}
                 </h2>
                 <span className="text-[10px] font-[800] text-[#cbd5e1] uppercase tracking-[0.2em]">Lanka Beacon Terminal</span>
              </div>

              <div className="p-10 flex-1">
                 {activeTab === 'settings' && (
                    <form onSubmit={handleSubmit} className="max-w-3xl space-y-10 animate-in fade-in duration-500">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                             <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Full Legal Name</label>
                             <input type="text" name="name" className="h-12 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" value={formData.name} onChange={handleChange} required />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Secure Email Interlink</label>
                             <input type="email" name="email" className="h-12 px-4 w-full bg-[#f8fafc] border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] text-[#94a3b8] cursor-not-allowed" value={formData.email} disabled />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Assigned Tactical Sector</label>
                             <input type="text" name="assignedArea" className="h-12 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" value={formData.assignedArea} onChange={handleChange} required />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Telegram Signal ID</label>
                             <input type="text" name="telegramChatId" className="h-12 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" value={formData.telegramChatId} onChange={handleChange} placeholder="Optional Chat ID" />
                          </div>
                       </div>

                       <div className="pt-8 border-t border-[#edf1f6]">
                          <button type="submit" disabled={isLoading} className="h-12 px-10 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-[#1768d1]/10 hover:bg-[#0f56b3] transition-all flex items-center gap-3">
                             {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                             Update Account
                          </button>
                       </div>
                    </form>
                 )}

                 {activeTab === 'security' && (
                    <form onSubmit={handlePasswordSubmit} className="max-w-3xl space-y-10 animate-in fade-in duration-500">
                       <div className="p-6 bg-[#fff9e8] rounded-[5px] border border-[#f8d68a] flex items-start gap-5">
                          <div className="w-10 h-10 bg-white/60 rounded-[5px] flex items-center justify-center text-[#b76300] border border-white">
                             <ShieldAlert size={22} />
                          </div>
                          <div className="space-y-1">
                             <p className="text-[13px] font-[800] text-[#b76300] uppercase tracking-tight leading-none">Security Protocol Alpha</p>
                             <p className="text-[11.5px] text-[#b76300]/80 font-[600] leading-relaxed uppercase tracking-wide mt-2">Modifying your access credentials will invalidate all other active sessions across the network mesh.</p>
                          </div>
                       </div>

                       <div className="space-y-8">
                          <div className="space-y-2">
                             <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Current Password</label>
                             <input type="password" name="currentPassword" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} className="h-12 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" required />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-2">
                                <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">New Access Key</label>
                                <input type="password" name="newPassword" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} className="h-12 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" required />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Confirm Access Key</label>
                                <input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className="h-12 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all" required />
                             </div>
                          </div>
                       </div>

                       <div className="pt-6 border-t border-[#edf1f6]">
                          <h3 className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] mb-5">Emergency Recovery Access</h3>
                          <div className="flex items-center justify-between p-5 bg-[#f8fafc] rounded-[5px] border border-[#dfe7f1] group transition-all">
                             <div className="flex items-center gap-5">
                                <div className="w-11 h-11 bg-white rounded-[5px] flex items-center justify-center text-[#1768d1] shadow-sm border border-[#dfe7f1] group-hover:bg-[#1768d1] group-hover:text-white transition-all">
                                   <Key size={20} />
                                </div>
                                <div className="space-y-1.5">
                                   <p className="text-[12px] font-[800] text-[#0f172a] uppercase tracking-widest leading-none">Global Recovery Signal Key</p>
                                   <p className="text-[11px] font-mono font-[700] text-[#64748b] tracking-[0.2em] leading-none uppercase">{fullProfile?.recoveryKey || 'ENCRYPTED'}</p>
                                </div>
                             </div>
                             <div className="h-7 px-3 bg-[#eaf2ff] text-[#1768d1] border border-[#1768d1]/20 rounded-[5px] flex items-center justify-center text-[9px] font-[800] uppercase tracking-widest">Active Signal</div>
                          </div>
                       </div>

                       <div className="pt-4">
                          <button type="submit" disabled={isLoading} className="h-12 px-10 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-[#1768d1]/10 hover:bg-[#0f56b3] transition-all flex items-center gap-3">
                             {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                             Update Security Matrix
                          </button>
                       </div>
                    </form>
                 )}

                 {activeTab === 'patrol' && (
                    <div className="space-y-10 animate-in fade-in duration-500 h-full flex flex-col">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#edf1f6] pb-8">
                          <div>
                             <h3 className="text-[18px] font-[800] text-[#0f172a] uppercase tracking-widest">Tactical Vector Boundaries</h3>
                             <p className="text-[#64748b] text-[12px] font-[600] mt-2 uppercase tracking-wider leading-relaxed">Establish the spatial perimeter for automated biological signature relay and command response</p>
                          </div>
                          <div className="h-10 px-4 bg-[#0f172a] text-white rounded-[5px] text-[10px] font-[800] uppercase tracking-[0.2em] border border-white/10 shadow-lg flex items-center justify-center">
                             System Matrix v4.22-S
                          </div>
                       </div>

                       <div className="flex-1 min-h-[500px] relative">
                          <div className="absolute inset-0 rounded-[5px] border border-[#dfe7f1] overflow-hidden shadow-2xl bg-[#f1f5f9] group">
                             <PatrolAreaSelector 
                               initialPolygon={fullProfile?.patrolArea} 
                               onSave={async (newPolygon) => {
                                 setIsLoading(true);
                                 try {
                                   const response = await api.put('/guards/me/patrol-area', {
                                     patrolArea: newPolygon,
                                   });
                                   const savedPatrolArea = response.data.patrolArea;
                                   const boundaryMetadata = {
                                     patrolArea: savedPatrolArea,
                                     patrolAreaUpdatedAt: response.data.updatedAt,
                                     patrolAreaPointCount: response.data.pointCount,
                                   };

                                   setFormData((current) => ({
                                     ...current,
                                     patrolArea: savedPatrolArea,
                                   }));
                                   setFullProfile((current) => ({
                                     ...current,
                                     ...boundaryMetadata,
                                   }));
                                   syncUser(boundaryMetadata);
                                   toast.success('Vector boundary synchronized with network');
                                   return savedPatrolArea;
                                 } catch (error) {
                                   toast.error(
                                     error.response?.data?.message
                                       || 'Boundary synchronization failed'
                                   );
                                   throw error;
                                 } finally {
                                   setIsLoading(false);
                                 }
                               }}
                             />
                             <div className="absolute top-6 left-6 z-[500] px-4 py-2 bg-[#0f172a]/95 backdrop-blur-sm text-white rounded-[5px] text-[10px] font-[800] uppercase tracking-widest border border-white/10 shadow-2xl flex items-center gap-3">
                                <div className="w-2 h-2 bg-[#18b866] rounded-full animate-pulse shadow-[0_0_8px_rgba(24,184,102,0.8)]"></div>
                                Tactical Matrix Active
                             </div>
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
