import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, User, Mail, Lock, MapPin, ArrowRight, Send, CheckCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

import PatrolAreaSelector from '../components/map/PatrolAreaSelector';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    assignedArea: '',
    telegramChatId: ''
  });
  const [patrolArea, setPatrolArea] = useState(null);
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAreaSave = (polygon) => {
    setPatrolArea(polygon);
    toast.success('Patrol area boundary established');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await register({ ...formData, patrolArea });
      if (data.requiresEmailVerification) {
        toast.success('Validation identity sent. Verify your email.');
        // Store session info temporarily for the verification page
        sessionStorage.setItem('pendingVerification', JSON.stringify({
          verificationSessionId: data.verificationSessionId,
          maskedEmail: data.maskedEmail,
          expiresInSeconds: data.expiresInSeconds,
          resendAvailableInSeconds: data.resendAvailableInSeconds
        }));
        navigate('/register/verify-email');
      } else {
        // Fallback if verification is somehow skipped by backend
        toast.success('Registration successful.');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f8fc] flex items-center justify-center p-6 font-sans">
      <div className={`${step === 1 ? 'max-w-[500px]' : 'max-w-[900px]'} w-full space-y-8 transition-all duration-500`}>
        <div className="text-center space-y-4">
          <Link to="/" className="inline-flex items-center justify-center w-16 h-16 bg-[#0b2d63] rounded-[5px] shadow-xl shadow-[#0b2d63]/10 mb-2">
            <img src="/lanka-beacon-icon.svg" alt="Lanka Beacon" className="w-10 h-10" />
          </Link>
          <div className="space-y-1">
             <h1 className="text-[28px] font-[800] text-[#0f172a] tracking-tight leading-none">
               Establish <span className="text-[#1768d1]">Guard Credentials</span>
             </h1>
             <p className="text-[#64748b] text-[12px] font-[700] uppercase tracking-widest">Authorized Wildlife Officer Registration</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[5px] shadow-md border border-[#dfe7f1] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-[#1768d1]"></div>
          
          <div className="mb-10 flex justify-between items-center border-b border-[#edf1f6] pb-6">
            <div>
              <h2 className="text-[16px] font-[800] text-[#0f172a] uppercase tracking-widest">
                {step === 1 ? 'Operational Identity' : 'Spatial Boundary Configuration'}
              </h2>
              <p className="text-[#64748b] text-[11px] font-[600] mt-1 uppercase tracking-wider">
                {step === 1 ? 'Configure your secure access credentials' : 'Establish your assigned command sector boundaries'}
              </p>
            </div>
            <div className="flex items-center gap-3">
               <div className={`h-8 px-4 rounded-[5px] flex items-center justify-center text-[10px] font-[800] tracking-widest uppercase transition-all ${step === 1 ? 'bg-[#eaf2ff] text-[#1768d1] border border-[#1768d1]/20' : 'bg-[#f1f5f9] text-[#94a3b8]'}`}>Phase 01</div>
               <ArrowRight size={14} className="text-[#cbd5e1]" />
               <div className={`h-8 px-4 rounded-[5px] flex items-center justify-center text-[10px] font-[800] tracking-widest uppercase transition-all ${step === 2 ? 'bg-[#eaf2ff] text-[#1768d1] border border-[#1768d1]/20' : 'bg-[#f1f5f9] text-[#94a3b8]'}`}>Phase 02</div>
            </div>
          </div>

          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Full Legal Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#1768d1] transition-colors" size={18} />
                  <input 
                    type="text" 
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Officer Name"
                    className="h-12 w-full pl-12 pr-4 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Secure Email Interlink</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#1768d1] transition-colors" size={18} />
                  <input 
                    type="email" 
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="officer@wildlife.gov.lk"
                    className="h-12 w-full pl-12 pr-4 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Assigned Sector</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#1768d1] transition-colors" size={18} />
                    <input 
                      type="text" 
                      name="assignedArea"
                      required
                      value={formData.assignedArea}
                      onChange={handleChange}
                      placeholder="e.g. Sector 04"
                      className="h-12 w-full pl-12 pr-4 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Telegram Chat ID</label>
                  <div className="relative group">
                    <Send className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#1768d1] transition-colors" size={18} />
                    <input 
                      type="text" 
                      name="telegramChatId"
                      value={formData.telegramChatId}
                      onChange={handleChange}
                      placeholder="Optional"
                      className="h-12 w-full pl-12 pr-4 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-[800] text-[#64748b] uppercase tracking-widest ml-1">Access Credentials</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cbd5e1] group-focus-within:text-[#1768d1] transition-colors" size={18} />
                  <input 
                    type="password" 
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="h-12 w-full pl-12 pr-4 bg-white border border-[#dfe7f1] rounded-[5px] text-[13px] font-[500] focus:border-[#2878e8] outline-none transition-all"
                  />
                </div>
              </div>

              <button 
                type="button"
                onClick={() => {
                  if (formData.name && formData.email && formData.password && formData.assignedArea) {
                    setStep(2);
                  } else {
                    toast.error('Required fields must be verified');
                  }
                }}
                className="w-full h-14 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[13px] uppercase tracking-[0.2em] shadow-xl shadow-[#1768d1]/20 hover:bg-[#0f56b3] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
              >
                Establish Spatial Context
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="space-y-8">
               <div className="border border-[#dfe7f1] rounded-[5px] overflow-hidden shadow-inner bg-[#f1f5f9]">
                 <PatrolAreaSelector onSave={handleAreaSave} />
               </div>
               
               <div className="flex gap-4">
                 <button 
                   type="button"
                   onClick={() => setStep(1)}
                   className="flex-1 h-14 bg-white text-[#475569] border border-[#dfe7f1] rounded-[5px] font-[800] text-[12px] uppercase tracking-widest hover:bg-[#f8fafc] transition-all"
                 >
                   Back
                 </button>
                 <button 
                   onClick={handleSubmit}
                   disabled={isLoading || !patrolArea}
                   className="flex-[2] h-14 bg-[#119c55] text-white rounded-[5px] font-[800] text-[13px] uppercase tracking-[0.2em] shadow-xl shadow-[#119c55]/10 hover:bg-[#0e7a42] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                 >
                   {isLoading ? (
                     <>
                       <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></div>
                       Synchronizing Network...
                     </>
                   ) : (
                     <>
                       Finalize Command Node
                       <CheckCircle size={20} />
                     </>
                   )}
                 </button>
               </div>
            </div>
          )}
        </div>

        <div className="text-center pt-2">
          <p className="text-[12px] font-[700] text-[#64748b] uppercase tracking-widest">
            Identity already verified? <Link to="/login" className="text-[#1768d1] font-[800] hover:underline ml-2 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;