import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNavbar from '../components/layout/TopNavbar';

const MainLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#f5f8fc] font-sans text-[#0f172a]">
      <TopNavbar />
      
      {/* Page Content */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto p-[22px] pb-[24px]">
        <div className="page-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
