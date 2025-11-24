import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, BarChart, Settings, ChevronsLeft, ChevronsRight, ArrowDownCircle, ArrowUpCircle, ClipboardList, Calculator, Store } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  onCloseMobile?: () => void;
}

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/inventory/items", icon: ShoppingBag, label: "Produk" },
  { to: "/inventory/incoming", icon: ArrowDownCircle, label: "Barang Masuk" },
  { to: "/inventory/outgoing", icon: ArrowUpCircle, label: "Distribusi (Keluar)" },
  { to: "/opname/sessions", icon: ClipboardList, label: "Stok Opname" },
  { to: "/calculator/hpp", icon: Calculator, label: "Kalkulator HPP" },
  { to: "/outlet", icon: Store, label: "Manajemen Outlet" }, // Updated Path
  { to: "/reports", icon: BarChart, label: "Laporan" },
  { to: "/settings", icon: Settings, label: "Pengaturan" },
];

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed, onCloseMobile }) => {
  return (
    <aside className={`relative bg-sidebar-background h-screen transition-all duration-300 ease-in-out flex flex-col border-r border-gray-200 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Header Alignment Fix */}
      <div className={`flex items-center h-16 border-b border-gray-200 bg-white transition-all duration-300 ${isCollapsed ? 'justify-center' : 'px-6'}`}>
        <img 
          src="https://i.imgur.com/DOjWG8r.png" 
          alt="ARTIRASA Logo" 
          className={`transition-all duration-300 ${isCollapsed ? 'w-8 h-8' : 'w-8 h-8'}`} 
        />
        {!isCollapsed && (
          <h1 className="text-lg font-bold ml-3 text-navbar-background tracking-tight whitespace-nowrap overflow-hidden">
            ARTIRASA
          </h1>
        )}
      </div>
      
      <nav className="flex-1 mt-4 overflow-y-auto custom-scrollbar">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-lg transition-all duration-200 group ${
                    isActive || (item.to === '/outlet' && location.pathname.startsWith('/outlet'))
                      ? 'bg-white text-sidebar-accent shadow-sm border border-gray-100'
                      : 'text-gray-500 hover:bg-white hover:text-sidebar-link-hover hover:shadow-sm'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon 
                      className={`transition-colors duration-200 ${isCollapsed ? 'mx-auto' : 'mr-3'} h-4 w-4`} 
                      strokeWidth={2}
                    />
                    {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                    
                    {!isCollapsed && (isActive || (item.to === '/outlet' && location.pathname.startsWith('/outlet'))) && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-accent" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)} 
        className="absolute top-16 right-0 translate-x-1/2 -translate-y-1/2 w-6 h-6 hidden lg:flex items-center justify-center rounded-full bg-white text-gray-400 border border-gray-200 shadow-md hover:text-sidebar-accent hover:border-sidebar-accent transition-all duration-200 z-50"
      >
        {isCollapsed ? <ChevronsRight size={12} /> : <ChevronsLeft size={12} />}
      </button>
      
      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        {!isCollapsed && <p className="text-[10px] text-center text-gray-400">© 2025 ARTIRASA</p>}
      </div>
    </aside>
  );
};

export default Sidebar;
