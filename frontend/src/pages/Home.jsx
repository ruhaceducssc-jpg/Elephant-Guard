import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight, MapPin, Bell, Smartphone, ShieldCheck, Activity, Users, Zap, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import lankaBeaconLogo from '../../design-reference/logo.png';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-[#0f172a] font-sans selection:bg-[#eaf2ff]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#dfe7f1] shadow-sm h-[86px] flex items-center">
        <div className="max-w-[1920px] w-full mx-auto px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-[52px] h-[52px] bg-[#0b2d63] rounded-[5px] flex items-center justify-center shadow-lg shadow-[#0b2d63]/10 transition-transform hover:scale-[1.02]">
                <img src={lankaBeaconLogo} alt="Lanka Beacon" className="w-[42px] h-[42px] object-contain" />
             </div>
             <div className="flex flex-col">
                <span className="font-[800] text-[24px] text-[#0b2d63] tracking-tighter leading-none uppercase">
                   Lanka <span className="text-[#1768d1]">Beacon</span>
                </span>
                <span className="text-[9px] font-[700] text-[#64748b] uppercase tracking-[0.2em] mt-1">Operational Network</span>
             </div>
          </div>
          <div className="flex items-center gap-6">
             {isAuthenticated ? (
               <Link to="/dashboard" className="h-11 px-8 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[11px] uppercase tracking-widest shadow-xl shadow-[#1768d1]/20 flex items-center gap-2 hover:bg-[#0f56b3] transition-all">
                  Lanka Beacon Command
                  <ArrowRight size={14} />
               </Link>
             ) : (
               <>
                 <Link to="/login" className="text-[11px] font-[800] uppercase tracking-widest text-[#64748b] hover:text-[#1768d1] transition-all">
                    Login
                 </Link>
                 <Link to="/register" className="h-11 px-8 bg-[#1768d1] text-white rounded-[5px] font-[800] text-[11px] uppercase tracking-widest shadow-xl shadow-[#1768d1]/20 flex items-center gap-2 hover:bg-[#0f56b3] transition-all">
                    Join Lanka Beacon
                 </Link>
               </>
             )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-[180px] pb-24 px-8 relative overflow-hidden">
         {/* Decorative Background Elements */}
         <div className="absolute top-0 right-0 w-1/3 h-full bg-[#eaf2ff]/30 -z-10 rounded-l-[50%] blur-[120px]"></div>
         <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-[#edfcf4]/30 -z-10 rounded-r-[50%] blur-[100px]"></div>

         <div className="max-w-[1920px] mx-auto grid lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-12 animate-in fade-in slide-in-from-left-8 duration-700">
               <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-[#eaf2ff] text-[#1768d1] rounded-[5px] text-[10px] font-[800] uppercase tracking-[0.2em] border border-[#1768d1]/10">
                  <div className="w-2 h-2 bg-[#2878e8] rounded-full animate-pulse shadow-[0_0_5px_rgba(40,120,232,0.8)]"></div>
                  Community Early Warning Network
               </div>
               <h1 className="text-6xl lg:text-[84px] font-[800] text-[#0f172a] leading-[0.95] tracking-tighter uppercase">
                  Lanka Beacon: <br/><span className="text-[#1768d1]">Community Safety</span> First
               </h1>
               <p className="text-lg text-[#64748b] font-[500] leading-relaxed max-w-xl uppercase tracking-wider">
                  AI-Powered Elephant Early Warning and Community Safety System. Bridging the gap between wildlife conservation and human protection.
               </p>
               <div className="flex flex-col sm:flex-row gap-6">
                  <Link to="/register" className="h-16 px-12 bg-[#1768d1] text-white rounded-[5px] text-[13px] uppercase tracking-[0.2em] font-[800] shadow-2xl shadow-[#1768d1]/20 hover:bg-[#0f56b3] transition-all flex items-center gap-3 active:scale-95">
                     Initiate Deployment
                     <ArrowRight size={20} />
                  </Link>
                  <div className="flex items-center gap-6 px-4">
                     <div className="flex -space-x-3">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="w-12 h-12 rounded-full border-4 border-white bg-[#f1f5f9] flex items-center justify-center text-[10px] font-[800] text-[#94a3b8] overflow-hidden shadow-md">
                             <img src={`/assets/images/user${i}.jpg`} alt="Guard" className="w-full h-full object-cover" />
                          </div>
                        ))}
                     </div>
                     <p className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-widest leading-tight">
                        <span className="text-[#0f172a]">450+ Verified</span> <br/> Wildlife Officers
                     </p>
                  </div>
               </div>
            </div>

            <div className="relative animate-in fade-in zoom-in-95 duration-1000">
               <div className="bg-white p-8 rounded-[5px] shadow-2xl border border-[#dfe7f1] relative z-10 group">
                  <div className="bg-[#0f172a] rounded-[5px] overflow-hidden aspect-[4/3] relative border border-[#dfe7f1]">
                     <img src="/assets/images/hero.jpg" alt="Elephant Protection" className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-105" />
                     <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent"></div>
                     <div className="absolute bottom-10 left-10 right-10 flex items-end justify-between">
                        <div className="space-y-3">
                           <p className="text-[10px] font-[800] text-[#1768d1] uppercase tracking-[0.4em]">Operational Area</p>
                           <h3 className="text-3xl font-[800] text-white uppercase tracking-tighter leading-none">Udawalawe Sector</h3>
                        </div>
                        <div className="w-16 h-16 bg-[#1768d1] rounded-[5px] flex items-center justify-center text-white shadow-2xl shadow-[#1768d1]/30 border border-white/20 transition-transform group-hover:rotate-12">
                           <Zap size={32} />
                        </div>
                     </div>
                  </div>
                  {/* Decorative Scan Line */}
                  <div className="absolute top-8 left-8 right-8 h-0.5 bg-[#18b866]/30 animate-scan"></div>
               </div>
            </div>
         </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-8 bg-white border-y border-[#dfe7f1]">
         <div className="max-w-[1920px] mx-auto space-y-24">
            <div className="text-center space-y-6">
               <h2 className="text-5xl font-[800] text-[#0f172a] uppercase tracking-tighter">Integrated <span className="text-[#1768d1]">Operational Logic</span></h2>
               <p className="text-[#94a3b8] font-[800] uppercase tracking-[0.3em] text-xs">A unified ecosystem for tactical response</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
               <FeatureCard 
                  icon={<Activity size={32} />} 
                  title="AI Detection" 
                  desc="Neural network trained for high-confidence biological pattern recognition in diverse terrains."
               />
               <FeatureCard 
                  icon={<Bell size={32} />} 
                  title="Instant Relay" 
                  desc="Multi-channel notification protocol delivering critical intel via Telegram Relay mesh."
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
                  desc="Automated geofencing logic establishing virtual safety barriers around villages."
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
      <footer className="py-24 px-8 border-t border-[#dfe7f1] bg-[#f8fafc]">
         <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-[#0f172a] rounded-[5px] flex items-center justify-center shadow-lg shadow-[#0f172a]/20">
                  <img src={lankaBeaconLogo} alt="Lanka Beacon" className="w-8 h-8 object-contain" />
               </div>
               <div className="flex flex-col">
                  <span className="font-[800] text-xl uppercase tracking-tighter leading-none">
                     Lanka <span className="text-[#1768d1]">Beacon</span>
                  </span>
                  <span className="text-[8px] font-[800] text-[#94a3b8] uppercase tracking-widest mt-1">Safety First · Network Stable</span>
               </div>
            </div>
            <p className="text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.2em] text-center">
               © 2026 Lanka Beacon Network · AI-Powered Elephant Early Warning System
            </p>
            <div className="flex gap-10">
               <a href="#" className="text-[10px] font-[800] text-[#64748b] hover:text-[#1768d1] transition-colors uppercase tracking-widest">Protocol</a>
               <a href="#" className="text-[10px] font-[800] text-[#64748b] hover:text-[#1768d1] transition-colors uppercase tracking-widest">Encryption</a>
               <a href="#" className="text-[10px] font-[800] text-[#64748b] hover:text-[#1768d1] transition-colors uppercase tracking-widest">Legal</a>
            </div>
         </div>
      </footer>
      
      <style>{`
        @keyframes scan {
          from { top: 32px; }
          to { top: calc(100% - 32px); }
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
      `}</style>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }) => (
  <div className="bg-white p-12 rounded-[5px] border border-[#dfe7f1] shadow-sm hover:border-[#1768d1]/30 hover:shadow-xl transition-all duration-500 group">
    <div className="w-16 h-16 bg-[#f4f8ff] text-[#1768d1] rounded-[5px] flex items-center justify-center mb-10 group-hover:bg-[#1768d1] group-hover:text-white transition-all duration-500 shadow-inner group-hover:shadow-lg group-hover:shadow-[#1768d1]/20 group-hover:-translate-y-2 border border-[#eaf2ff]">
      {React.cloneElement(icon, { size: 32, strokeWidth: 2.5 })}
    </div>
    <h3 className="text-xl font-[800] text-[#0f172a] mb-5 uppercase tracking-tighter leading-none">{title}</h3>
    <p className="text-[#64748b] font-[600] leading-relaxed text-[13px] uppercase tracking-wide opacity-80">{desc}</p>
  </div>
);

export default Home;
