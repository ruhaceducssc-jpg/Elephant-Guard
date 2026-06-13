import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Mail, Lock, ArrowRight, Key, RefreshCw, Eye, EyeOff, Shield } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const ForgotPassword = () => {
  const [formData, setFormData] = useState({
    email: '',
    recoveryKey: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    if (formData.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    
    setIsLoading(true);
    try {
      await api.post('/guards/forgot-password', {
        email: formData.email,
        recoveryKey: formData.recoveryKey,
        newPassword: formData.newPassword
      });
      toast.success('Password reset successful. Please sign in with your new password.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Recovery failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f8fc] flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#f59e0b]/5 blur-[120px] -z-10 rounded-full translate-x-1/3 -translate-y-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#1768d1]/5 blur-[100px] -z-10 rounded-full -translate-x-1/4 translate-y-1/4"></div>

      <div className="max-w-[480px] w-full space-y-8 animate-in fade-in duration-700">
        <div className="text-center space-y-5">
          <Link to="/" className="inline-flex items-center justify-center w-[72px] h-[72px] bg-[#0f172a] rounded-[5px] shadow-2xl shadow-[#0f172a]/20 mb-2">
            <Key size={36} className="text-[#f59e0b]" />
          </Link>
          <div className="space-y-1">
            <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight leading-none uppercase">
              Account <span className="text-[#f59e0b]">Recovery</span>
            </h1>
            <p className="text-[#64748b] text-[12px] font-[800] uppercase tracking-[0.3em]">Authorized Access Restoration Protocol</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[5px] shadow-xl border border-[#dfe7f1] relative">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-[#f59e0b]"></div>
          
          <div className="mb-10">
            <h2 className="text-[17px] font-[800] text-[#0f172a] uppercase tracking-widest leading-none">Initialize Reset</h2>
            <p className="text-[#94a3b8] text-[10.5px] font-[700] uppercase tracking-[0.15em] mt-3">Enter registry email and recovery matrix key</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Registry Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#1768d1] transition-colors" size={18} />
                <input 
                  type="email" 
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="officer@lankabeacon.lk"
                  className="h-12 w-full pl-12 pr-4 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Global Recovery Key</label>
              <div className="relative group">
                <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#f59e0b] transition-colors" size={18} />
                <input 
                  type={showRecoveryKey ? 'text' : 'password'} 
                  name="recoveryKey"
                  required
                  value={formData.recoveryKey}
                  onChange={handleChange}
                  placeholder="Enter secret restoration phrase"
                  className="h-12 w-full pl-12 pr-12 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowRecoveryKey(!showRecoveryKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] hover:text-[#0f172a] transition-colors"
                >
                  {showRecoveryKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-[#edf1f6] mt-8 pt-8">
              <div className="space-y-2">
                <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">New Access Key</label>
                <div className="relative group">
                  <input 
                    type={showNewPassword ? 'text' : 'password'} 
                    name="newPassword"
                    required
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="h-11 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#cbd5e1] hover:text-[#0f172a]"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Confirm Key</label>
                <div className="relative group">
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="h-11 px-4 w-full bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#cbd5e1] hover:text-[#0f172a]"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-[#0f172a] text-white rounded-[5px] font-[800] text-[13px] uppercase tracking-[0.2em] shadow-xl shadow-[#0f172a]/20 hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  Override Matrix Keys
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center pt-2">
          <p className="text-[12px] font-[700] text-[#64748b] uppercase tracking-widest">
            Credentials retrieved? <Link to="/login" className="text-[#1768d1] font-[800] hover:underline ml-2 transition-all">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;