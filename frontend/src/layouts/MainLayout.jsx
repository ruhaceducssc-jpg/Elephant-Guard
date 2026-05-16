import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { Bell, Search, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MainLayout = () => {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between z-10">
          <div className="flex items-center bg-gray-100 px-3 py-1.5 rounded-lg w-96">
            <Search size={18} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search zones, alerts, or residents..." 
              className="bg-transparent border-none focus:ring-0 text-sm w-full ml-2"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="relative text-gray-500 hover:text-primary-600 transition">
              <Bell size={22} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white">
                3
              </span>
            </button>
            
            <Link to="/dashboard/profile" className="flex items-center gap-3 pl-6 border-l hover:opacity-80 transition-opacity">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-800">{user?.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{user?.assignedArea || 'Wildlife Guard'}</p>
              </div>
              <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold overflow-hidden">
                {user?.avatar ? (
                  <img 
                    src={`${import.meta.env.VITE_API_URL.replace('/api', '')}/uploads/${user.avatar}`} 
                    alt="User" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.name?.split(' ').map(n => n[0]).join('')
                )}
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
