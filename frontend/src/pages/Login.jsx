import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import lankaBeaconLogo from '../../design-reference/logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Login successful. Welcome back.');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Authentication failed: Invalid credentials';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f8fc] flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1768d1]/5 blur-[120px] -z-10 rounded-full translate-x-1/3 -translate-y-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#119c55]/5 blur-[100px] -z-10 rounded-full -translate-x-1/4 translate-y-1/4"></div>

      <div className="max-w-[450px] w-full space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
        <div className="text-center space-y-5">
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] bg-white rounded-[5px] shadow-2xl shadow-[#0b2d63]/20 mb-2 overflow-hidden border border-[#dfe7f1]">
            <img src={lankaBeaconLogo} alt="Lanka Beacon" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-1">
            <h1 className="text-[32px] font-[800] text-[#0b2d63] tracking-tighter leading-none">
              LANKA <span className="text-[#1768d1]">BEACON</span>
            </h1>
            <p className="text-[#64748b] text-[10px] font-[800] uppercase tracking-[0.3em]">Authorized Access Only</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[5px] shadow-xl border border-[#dfe7f1] relative">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-[#1768d1]"></div>
          
          <div className="mb-10 text-center">
            <h2 className="text-[18px] font-[800] text-[#0f172a] uppercase tracking-widest leading-none">Command Center Access</h2>
            <p className="text-[#94a3b8] text-[10px] font-[700] uppercase tracking-[0.2em] mt-3">Secure identity verification required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Registry Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#1768d1] transition-colors" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@lankabeacon.lk"
                  className="h-12 w-full pl-12 pr-4 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Matrix Key</label>
                <Link to="/forgot-password" size="sm" className="text-[10px] font-[800] text-[#1768d1] hover:underline uppercase tracking-widest transition-all">Recover Signal</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#1768d1] transition-colors" size={18} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full pl-12 pr-12 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] hover:text-[#0f172a] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[13px] uppercase tracking-[0.2em] shadow-xl shadow-[#1768d1]/20 hover:bg-[#0f56b3] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-8"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : (
                <>
                  Establish Connection
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center pt-2">
          <p className="text-[12px] font-[700] text-[#64748b] uppercase tracking-widest">
            New Guard identity? <Link to="/register" className="text-[#1768d1] font-[800] hover:underline ml-2 transition-all">Register Mesh Node</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;