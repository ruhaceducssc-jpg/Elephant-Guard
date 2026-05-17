import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

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
      toast.error('Authentication failed: Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-[400px] w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl shadow-xl shadow-primary-200 mb-2">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Elephant <span className="text-primary-600">Guard</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">Sri Lanka Wildlife Monitoring System</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary-600"></div>
          
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900">Sign In</h2>
            <p className="text-slate-500 text-xs">Enter your credentials to access the dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@wildlife.gov.lk"
                  className="input pl-12"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Password</label>
                <Link to="/forgot-password" size="sm" className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors">Forgot?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-12 pr-12"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3 text-slate-400 hover:text-primary-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-200 hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center pt-2">
          <p className="text-sm font-medium text-slate-500">
            Don't have an account? <Link to="/register" className="text-primary-600 font-bold hover:text-primary-700 transition-colors">Request access</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
