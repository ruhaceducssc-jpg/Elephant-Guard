import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNavbar from '../components/layout/TopNavbar';

const MainLayout = () => {
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      <TopNavbar />
      
      {/* Page Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-[1800px] mx-auto page-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
