import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Mail, Lock, ArrowRight, Key, CheckCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const ForgotPassword = () => {
  const [formData, setFormData] = useState({
    email: '',
    securityKey: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSecurityKey, setShowSecurityKey] = useState(false);
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
      await api.post('/guards/recover', {
        email: formData.email,
        securityKey: formData.securityKey,
        newPassword: formData.newPassword
      });
      toast.success('Password recovered successfully! Please login.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Recovery failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-primary-600 p-8 text-white text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <Key size={32} />
          </div>
          <h1 className="text-2xl font-bold">Account Recovery</h1>
          <p className="text-primary-100 text-sm mt-1">Reset your command access using Security Key</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Command Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="email" 
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="guard@wildlife.gov.lk"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent transition outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Security Recovery Key</label>
              <div className="relative">
                <ShieldAlert className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type={showSecurityKey ? 'text' : 'password'} 
                  name="securityKey"
                  required
                  value={formData.securityKey}
                  onChange={handleChange}
                  placeholder="Enter your secret key"
                  className="w-full pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent transition outline-none"
                />
                <button 
                  type="button"
                  onClick={() => setShowSecurityKey(!showSecurityKey)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-primary-600"
                >
                  {showSecurityKey ? <RefreshCw size={16} /> : <Key size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  name="newPassword"
                  required
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent transition outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Confirm New Password</label>
              <div className="relative">
                <CheckCircle className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="password" 
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent transition outline-none"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-4 bg-primary-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary-700 transition disabled:opacity-50 shadow-lg shadow-primary-100"
            >
              {isLoading ? 'Processing Recovery...' : 'Reset Password'}
              {!isLoading && <ArrowRight size={20} />}
            </button>
          </form>

          <div className="mt-6 text-center border-t pt-4">
            <p className="text-sm text-gray-500">
              Remembered your password? <Link to="/login" className="text-primary-600 font-bold hover:underline">Back to Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
