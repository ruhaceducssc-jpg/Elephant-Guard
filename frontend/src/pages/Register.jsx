import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, User, Mail, Lock, MapPin, ArrowRight, Send, CheckCircle } from 'lucide-react';
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
      await register({ ...formData, patrolArea });
      toast.success('Registration successful. Welcome to the network.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-[480px] w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl shadow-xl shadow-primary-200 mb-2">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Guard <span className="text-primary-600">Registration</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">Join the Elephant Alert monitoring network</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary-600"></div>
          
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {step === 1 ? 'Step 1: Account Details' : 'Step 2: Patrol Area'}
              </h2>
              <p className="text-slate-500 text-xs">
                {step === 1 ? 'Enter your basic information' : 'Draw your assigned patrol boundary on the map'}
              </p>
            </div>
            <div className="flex gap-1">
               <div className={`w-8 h-1 rounded-full ${step === 1 ? 'bg-primary-600' : 'bg-slate-200'}`}></div>
               <div className={`w-8 h-1 rounded-full ${step === 2 ? 'bg-primary-600' : 'bg-slate-200'}`}></div>
            </div>
          </div>

          {step === 1 ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="label ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-3 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Officer Name"
                    className="input pl-12"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="label ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-3 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                  <input 
                    type="email" 
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="namal@wildlife.gov.lk"
                    className="input pl-12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="label ml-1">Assigned Sector</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-3 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      name="assignedArea"
                      required
                      value={formData.assignedArea}
                      onChange={handleChange}
                      placeholder="e.g. Yala"
                      className="input pl-12"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="label ml-1">Telegram ID</label>
                  <div className="relative group">
                    <Send className="absolute left-4 top-3 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      name="telegramChatId"
                      value={formData.telegramChatId}
                      onChange={handleChange}
                      placeholder="Optional"
                      className="input pl-12"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="label ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-3 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                  <input 
                    type="password" 
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="input pl-12"
                  />
                </div>
              </div>

              <button 
                type="button"
                onClick={() => {
                  if (formData.name && formData.email && formData.password && formData.assignedArea) {
                    setStep(2);
                  } else {
                    toast.error('Please fill required fields');
                  }
                }}
                className="w-full py-3.5 mt-4 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-200 hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Next Step
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
               <PatrolAreaSelector onSave={handleAreaSave} />
               
               <div className="flex gap-4">
                 <button 
                   type="button"
                   onClick={() => setStep(1)}
                   className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                 >
                   Back
                 </button>
                 <button 
                   onClick={handleSubmit}
                   disabled={isLoading || !patrolArea}
                   className="flex-[2] py-3.5 bg-primary-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-200 hover:bg-primary-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                 >
                   {isLoading ? (
                     <>
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       Finishing...
                     </>
                   ) : (
                     <>
                       Complete Registration
                       <CheckCircle size={18} />
                     </>
                   )}
                 </button>
               </div>
            </div>
          )}
        </div>

        <div className="text-center pt-2">
          <p className="text-sm font-medium text-slate-500">
            Already have an account? <Link to="/login" className="text-primary-600 font-bold hover:text-primary-700 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
