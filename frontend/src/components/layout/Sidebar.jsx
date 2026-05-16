import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Camera, Map, History, UserPlus, User, LogOut, ShieldAlert, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { logout } = useAuth();

  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/dashboard/detection', name: 'AI Scanner', icon: <Camera size={20} /> },
    { path: '/dashboard/map', name: 'Live Map', icon: <Map size={20} /> },
    { path: '/dashboard/history', name: 'Alert History', icon: <History size={20} /> },
    { path: '/dashboard/delivery', name: 'Delivery Tracking', icon: <Send size={20} /> },
    { path: '/dashboard/register-user', name: 'Register Resident', icon: <UserPlus size={20} /> },
    { path: '/dashboard/profile', name: 'Profile', icon: <User size={20} /> },
  ];

  return (
    <div className="w-64 bg-white border-r h-full flex flex-col">
      <Link to="/dashboard" className="p-6 flex items-center gap-2 border-b hover:bg-gray-50 transition-colors">
        <ShieldAlert className="text-primary-600" size={32} />
        <span className="font-bold text-xl text-primary-700 leading-tight">
          Elephant <br/> <span className="text-gray-500 text-sm font-medium">Alert SL</span>
        </span>
      </Link>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isActive ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`
            }
          >
            {item.icon}
            {item.name}
          </NavLink>
        ))}
      </nav>

      <button 
        onClick={logout}
        className="m-4 p-3 flex items-center gap-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
      >
        <LogOut size={20} />
        Logout
      </button>
    </div>
  );
};

export default Sidebar;
