import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight, MapPin, Bell, Smartphone, ShieldCheck, Activity, Users, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white text-secondary-900 font-inter selection:bg-primary-100">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-secondary-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                <ShieldAlert className="text-white" size={24} />
             </div>
             <span className="font-black text-xl uppercase tracking-tighter">
                Elephant <span className="text-primary-600">Guard</span>
             </span>
          </div>
          <div className="flex items-center gap-4">
             {isAuthenticated ? (
               <Link to="/dashboard" className="btn btn-primary px-8 uppercase tracking-widest text-[10px] font-black">
                  Control Center
               </Link>
             ) : (
               <>
                 <Link to="/login" className="text-xs font-black uppercase tracking-widest text-secondary-500 hover:text-primary-600 transition-colors">
                    Login
                 </Link>
                 <Link to="/register" className="btn btn-primary px-8 uppercase tracking-widest text-[10px] font-black shadow-xl shadow-primary-500/20">
                    Join Network
                 </Link>
               </>
             )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-1/2 h-full bg-secondary-50 skew-x-12 translate-x-20 -z-10 rounded-l-[10rem]"></div>
         <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10 animate-in fade-in slide-in-from-left-8 duration-700">
               <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-primary-100">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                  Strategic Protection Network
               </div>
               <h1 className="text-6xl lg:text-7xl font-black text-secondary-900 leading-[1.05] uppercase tracking-tighter">
                  Securing the <span className="text-primary-600">Frontier</span> of Sri Lanka
               </h1>
               <p className="text-lg text-secondary-500 font-medium leading-relaxed max-w-xl uppercase tracking-wide">
                  Advanced AI Biosensors & Real-time Resident Relay System. Bridging the gap between wildlife conservation and community safety.
               </p>
               <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/register" className="btn btn-primary px-10 py-5 text-sm uppercase tracking-[0.2em] font-black shadow-2xl shadow-primary-500/30 active:scale-95">
                     Initiate Deployment
                     <ArrowRight size={20} />
                  </Link>
                  <div className="flex items-center gap-6 px-4">
                     <div className="flex -space-x-3">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-secondary-100 flex items-center justify-center text-[10px] font-black text-secondary-400 overflow-hidden">
                             <img src={`/assets/images/user${i}.jpg`} alt="Guard" className="w-full h-full object-cover" />
                          </div>
                        ))}
                     </div>
                     <p className="text-[10px] font-black text-secondary-400 uppercase tracking-widest leading-tight">
                        <span className="text-secondary-900">450+ Verified</span> <br/> Wildlife Officers
                     </p>
                  </div>
               </div>
            </div>

            <div className="relative animate-in fade-in zoom-in-95 duration-1000">
               <div className="bg-white p-6 rounded-[4rem] shadow-2xl border border-secondary-100 relative z-10 group">
                  <div className="bg-secondary-900 rounded-[3rem] overflow-hidden aspect-[4/3] relative">
                     <img src="/assets/images/hero.jpg" alt="Elephant Protection" className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-105" />
                     <div className="absolute inset-0 bg-gradient-to-t from-secondary-900 to-transparent"></div>
                     <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between">
                        <div className="space-y-2">
                           <p className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em]">Operational Area</p>
                           <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Udawalawe Sector</h3>
                        </div>
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-primary-600 shadow-xl border-4 border-primary-600/20">
                           <Zap size={28} />
                        </div>
                     </div>
                  </div>
               </div>
               {/* Floating elements */}
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-100/50 rounded-[3rem] -z-10 animate-blob"></div>
               <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-secondary-50 rounded-[4rem] -z-10 animate-blob animation-delay-2000"></div>
            </div>
         </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 bg-secondary-50/50">
         <div className="max-w-7xl mx-auto space-y-20">
            <div className="text-center space-y-6">
               <h2 className="text-4xl font-black text-secondary-900 uppercase tracking-tighter">Integrated <span className="text-primary-600">Operational Logic</span></h2>
               <p className="text-secondary-400 font-bold uppercase tracking-[0.2em] text-xs">A unified ecosystem for tactical response</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
               <FeatureCard 
                  icon={<Activity size={32} />} 
                  title="AI Detection" 
                  desc="Neural network trained for high-confidence biological pattern recognition in diverse terrains."
               />
               <FeatureCard 
                  icon={<Bell size={32} />} 
                  title="Instant Relay" 
                  desc="Multi-channel notification protocol delivering critical intel via Telegram, Email, and SMS."
               />
               <FeatureCard 
                  icon={<MapPin size={32} />} 
                  title="Precision Mapping" 
                  desc="Dynamic geospatial visualization of active threats and resident geofence nodes."
               />
               <FeatureCard 
                  icon={<Users size={32} />} 
                  title="Officer Network" 
                  desc="Encrypted command hierarchy for coordinated response between sector guards."
               />
               <FeatureCard 
                  icon={<ShieldCheck size={32} />} 
                  title="Safe Zones" 
                  desc="Automated geofencing logic establishing virtual safety barriers around local villages."
               />
               <FeatureCard 
                  icon={<Smartphone size={32} />} 
                  title="Mobile Command" 
                  desc="Full theater operational capability from any authorized mobile terminal."
               />
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-secondary-100">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-secondary-900 rounded-lg flex items-center justify-center shadow-lg shadow-secondary-900/20">
                  <ShieldAlert className="text-white" size={18} />
               </div>
               <span className="font-black text-lg uppercase tracking-tighter">
                  Elephant <span className="text-primary-600">Guard</span>
               </span>
            </div>
            <p className="text-[10px] font-black text-secondary-400 uppercase tracking-[0.2em]">
               © 2026 Department of Wildlife Conservation · National Security Intelligence
            </p>
            <div className="flex gap-8">
               <a href="#" className="text-[10px] font-black text-secondary-500 hover:text-primary-600 transition-colors uppercase tracking-widest">Protocol</a>
               <a href="#" className="text-[10px] font-black text-secondary-500 hover:text-primary-600 transition-colors uppercase tracking-widest">Encryption</a>
               <a href="#" className="text-[10px] font-black text-secondary-500 hover:text-primary-600 transition-colors uppercase tracking-widest">Legal</a>
            </div>
         </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }) => (
  <div className="bg-white p-10 rounded-[3rem] border border-secondary-100 shadow-premium hover:border-primary-300 transition-all duration-500 group">
    <div className="w-16 h-16 bg-secondary-50 text-secondary-400 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary-600 group-hover:text-white transition-all duration-500 shadow-inner group-hover:shadow-lg group-hover:shadow-primary-500/20 group-hover:-translate-y-2">
      {icon}
    </div>
    <h3 className="text-xl font-black text-secondary-900 mb-4 uppercase tracking-tighter leading-none">{title}</h3>
    <p className="text-secondary-400 font-medium leading-relaxed text-sm uppercase tracking-wide">{desc}</p>
  </div>
);

export default Home;
