import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Mail, Lock, ArrowRight, Key, RefreshCw, Eye, EyeOff } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-[440px] w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl shadow-xl mb-2">
            <Key size={32} className="text-primary-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Account <span className="text-primary-600">Recovery</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">Restore your command access</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-900"></div>
          
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900">Reset Password</h2>
            <p className="text-slate-500 text-xs">Enter your email and recovery key to reset your password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="label ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3 text-slate-400" size={18} />
                <input 
                  type="email" 
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="officer@wildlife.gov.lk"
                  className="input pl-12"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label ml-1">Recovery Key</label>
              <div className="relative group">
                <ShieldAlert className="absolute left-4 top-3 text-slate-400" size={18} />
                <input 
                  type={showRecoveryKey ? 'text' : 'password'} 
                  name="recoveryKey"
                  required
                  value={formData.recoveryKey}
                  onChange={handleChange}
                  placeholder="Enter secret phrase"
                  className="input pl-12 pr-12"
                />
                <button 
                  type="button"
                  onClick={() => setShowRecoveryKey(!showRecoveryKey)}
                  className="absolute right-4 top-3 text-slate-400 hover:text-primary-600 transition-colors"
                >
                  {showRecoveryKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="label ml-1">New Password</label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? 'text' : 'password'} 
                    name="newPassword"
                    required
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="input pr-10"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="label ml-1">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="input pr-10"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-4 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                <>
                  Reset Password
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center pt-2">
          <p className="text-sm font-medium text-slate-500">
            Remembered your credentials? <Link to="/login" className="text-primary-600 font-bold hover:text-primary-700 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
