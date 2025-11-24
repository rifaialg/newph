import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import ChatWidget from './ChatWidget'; // Import ChatWidget

const MainLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Desktop Sidebar Wrapper - Increased Z-Index to stay above sticky headers */}
      <div className="hidden lg:block relative z-40">
        <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
      </div>
      
      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:hidden`}>
        <Sidebar 
          isCollapsed={false} 
          setIsCollapsed={() => {}} 
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
      </div>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black opacity-50 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Navbar onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 md:p-6">
          <Outlet />
        </main>
        
        {/* AI Chatbot Widget (Global) */}
        <ChatWidget />
      </div>
    </div>
  );
};

export default MainLayout;
