import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Camera, Map, History, UserPlus, 
  User, LogOut, ShieldAlert, Send, Menu, X, ChevronDown, MapPin, Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TopNavbar = () => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', name: 'Overview', icon: <LayoutDashboard size={18} /> },
    { path: '/dashboard/detection', name: 'AI Scanner', icon: <Camera size={18} /> },
    { path: '/dashboard/map', name: 'Tactical Map', icon: <Map size={18} /> },
    { path: '/dashboard/history', name: 'Incident Logs', icon: <History size={18} /> },
    { path: '/dashboard/delivery', name: 'Tracking', icon: <Send size={18} /> },
    { path: '/dashboard/register-user', name: 'Registrations', icon: <UserPlus size={18} /> },
    { path: '/dashboard/profile', name: 'Profile', icon: <User size={18} /> },
  ];

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm font-sans">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          {/* Left: Brand Logo */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-3 group shrink-0">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:scale-105 transition-transform duration-300">
                <ShieldAlert className="text-white" size={24} />
              </div>
              <div className="hidden md:block">
                <h1 className="font-black text-lg text-slate-900 tracking-tighter leading-none">
                  ELEPHANT <span className="text-emerald-600 block text-[10px] tracking-[0.2em] mt-0.5 font-bold uppercase">Guard Pro</span>
                </h1>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:ml-10 lg:flex lg:space-x-1">
              {menuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => 
                    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {/* Right: Tactical Status & User Profile */}
          <div className="flex items-center gap-2 md:gap-6">
            {/* Tactical Status (Hidden on small mobile) */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Network Active</span>
            </div>

            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

            {/* Officer Profile Dropdown/Link */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 leading-none">{user?.name || 'Officer'}</p>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest flex items-center justify-end gap-1">
                   <MapPin size={8} className="text-emerald-500" />
                   {user?.assignedArea || 'Sector 01'}
                </p>
              </div>
              
              <Link to="/dashboard/profile" className="relative group">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-bold overflow-hidden border-2 border-white shadow-soft group-hover:border-emerald-200 transition-all">
                  {user?.avatar ? (
                    <img 
                      src={user.avatar.startsWith('http') ? user.avatar : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}/uploads/${user.avatar}`} 
                      alt="User" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-600 text-white uppercase text-base font-black">
                      {user?.name ? user.name.charAt(0) : <User size={18} />}
                    </div>
                  )}
                </div>
              </Link>

              <button 
                onClick={logout}
                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all group"
                title="Sign Out"
              >
                <LogOut size={20} className="group-active:scale-90 transition-transform" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden">
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-200">
          <div className="px-4 pt-2 pb-6 space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => 
                  `flex items-center gap-4 px-4 py-4 rounded-xl text-base font-bold transition-all ${
                    isActive 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`
                }
              >
                {item.icon}
                {item.name}
              </NavLink>
            ))}
            <div className="pt-4 mt-4 border-t border-slate-100">
              <button 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-4 w-full px-4 py-4 rounded-xl text-base font-bold text-rose-600 hover:bg-rose-50 transition-all"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default TopNavbar;
