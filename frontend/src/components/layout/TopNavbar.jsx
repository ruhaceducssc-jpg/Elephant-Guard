import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Camera, Map, History, UserPlus, 
  User, LogOut, ShieldAlert, Send, Menu, X, MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import lankaBeaconLogo from '../../../design-reference/logo.png';

const TopNavbar = () => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard', name: 'Overview', icon: <LayoutDashboard size={18} /> },
    { path: '/dashboard/detection', name: 'Scanner', icon: <Camera size={18} /> },
    { path: '/dashboard/map', name: 'Map', icon: <Map size={18} /> },
    { path: '/dashboard/history', name: 'Logs', icon: <History size={18} /> },
    { path: '/dashboard/delivery', name: 'Tracking', icon: <Send size={18} /> },
    { path: '/dashboard/register-user', name: 'Registrations', icon: <UserPlus size={18} /> },
    { path: '/dashboard/profile', name: 'Profile', icon: <User size={18} /> },
  ];

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <header className="h-[86px] bg-white border-b border-[#dfe7f1] shadow-sm sticky top-0 z-[1000] w-full box-border">
      <div className="max-w-[1920px] w-full mx-auto h-full px-6 grid grid-cols-[auto_1fr_auto] items-center gap-4 lg:gap-10">
        {/* Brand Section */}
        <div className="flex items-center shrink-0 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-[56px] h-[56px] flex items-center justify-center transition-transform group-hover:scale-[1.02] shrink-0">
              <img src={lankaBeaconLogo} alt="Lanka Beacon elephant logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-[26px] font-[800] text-[#0b2d63] tracking-tighter leading-none truncate">
                Lanka Beacon
              </h1>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center justify-center min-w-0">
          <div className="flex items-center gap-1 xl:gap-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard'}
                className={({ isActive }) => 
                  `flex items-center gap-2.5 h-[48px] px-3 xl:px-4 rounded-[5px] text-[13.5px] font-[600] transition-all border-b-2 shrink-0 ${
                    isActive 
                      ? 'bg-[#eaf2ff] text-[#1768d1] border-[#1768d1]' 
                      : 'text-[#334155] border-transparent hover:bg-[#f4f8ff] hover:text-[#1768d1]'
                  }`
                }
              >
                {React.cloneElement(item.icon, { size: 18, strokeWidth: 2.5 })}
                <span className="hidden xl:inline">{item.name}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-3 xl:gap-4 shrink-0 justify-end">
          <div className="hidden sm:flex h-10 px-4 bg-[#edfcf4] border border-[#b7efcf] rounded-[5px] items-center gap-2 text-[#0e7a42] font-[700] text-[10px] xl:text-[11px] uppercase tracking-wider shadow-sm shrink-0">
            <div className="w-2 h-2 bg-[#18b866] rounded-full animate-pulse shrink-0"></div>
            <span className="hidden xl:inline">Network Active</span>
            <span className="xl:hidden">Active</span>
          </div>

          <div className="hidden md:block h-10 w-px bg-slate-200 shrink-0"></div>

          <div className="hidden sm:flex items-center gap-3 min-w-0">
            <div className="text-right hidden xl:block min-w-0 max-w-[150px]">
              <p className="text-[14px] font-[700] text-slate-900 leading-none truncate">{user?.name || 'Officer'}</p>
              <p className="text-[10px] font-[700] text-slate-400 uppercase tracking-widest mt-1.5 flex items-center justify-end gap-1">
                 <MapPin size={10} className="text-[#2878e8]" />
                 <span className="truncate">{user?.assignedArea || 'Sector 01'}</span>
              </p>
            </div>
            <Link to="/dashboard/profile" className="w-11 h-11 bg-slate-100 rounded-[5px] overflow-hidden border border-slate-200 hover:border-[#2878e8] transition-colors shrink-0 shadow-sm">
               {user?.avatar ? (
                 <img src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${user.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-[#eaf2ff] text-[#1768d1] font-bold text-lg">
                   {user?.name?.charAt(0)}
                 </div>
               )}
            </Link>
          </div>

          <button 
            onClick={logout}
            className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-[#e02424] hover:bg-[#fff1f1] rounded-[5px] transition-all border border-transparent hover:border-[#facaca] shrink-0"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
          
          {/* Mobile Toggle */}
          <div className="lg:hidden flex items-center ml-2">
            <button 
              className="p-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-[5px] hover:bg-slate-100 transition-colors"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-[88px] left-0 right-0 bg-white border-b border-slate-200 shadow-2xl lg:hidden flex flex-col p-4 gap-2 animate-in slide-in-from-top-4 duration-300 z-[1001]">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => 
                `flex items-center gap-4 p-4 rounded-[5px] font-[700] text-[14px] transition-all ${
                  isActive ? 'bg-[#eaf2ff] text-[#1768d1] border-l-4 border-[#1768d1]' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {React.cloneElement(item.icon, { size: 20 })}
              {item.name}
            </NavLink>
          ))}
          <div className="h-px bg-slate-100 my-2"></div>
          <button 
            onClick={() => { logout(); setIsMobileMenuOpen(false); }}
            className="flex items-center gap-4 p-4 rounded-[5px] font-[700] text-[14px] text-[#e02424] hover:bg-[#fff1f1] transition-all"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
};

export default TopNavbar;