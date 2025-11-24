import React, { useState, useRef, useEffect } from 'react';
import { Menu, User, LogOut, ChevronsUpDown, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('You have been logged out.');
      navigate('/auth/login');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Generate initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="bg-white h-16 flex items-center justify-between px-6 shadow-sm border-b border-gray-200 z-20 sticky top-0 transition-all duration-300">
      <div className="flex items-center">
        <button 
          onClick={onMenuClick} 
          className="lg:hidden p-2 -ml-2 mr-2 text-gray-500 hover:text-navbar-accent-1 hover:bg-gray-50 rounded-lg transition-all"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center space-x-3 md:space-x-4">
        {/* Notification Bell */}
        <button className="p-2 text-gray-400 hover:text-navbar-accent-1 hover:bg-gray-50 rounded-full transition-all relative group">
          <Bell size={20} />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>

        <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
            className="flex items-center space-x-2 md:space-x-3 p-1 rounded-lg hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200 group outline-none"
          >
            <div className="relative">
              {/* Custom Avatar based on image */}
              <div className="w-10 h-10 rounded-full bg-[#C89A4B] text-white flex items-center justify-center text-sm font-bold shadow-sm border-2 border-white">
                {user?.full_name ? getInitials(user.full_name) : 'US'}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            
            <div className="hidden md:flex flex-col items-start text-left">
              <span className="text-sm font-bold text-gray-800 leading-none">{user?.full_name || 'User'}</span>
              <span className="text-xs text-gray-500 leading-none mt-1 capitalize font-medium">{user?.role || 'Owner'}</span>
            </div>
            <ChevronsUpDown size={16} className="text-gray-400 group-hover:text-navbar-accent-1 transition-colors" />
          </button>
          
          {isDropdownOpen && (
            <div 
              className="absolute right-0 mt-3 w-72 bg-white rounded-2xl shadow-xl py-2 z-50 border border-gray-100 ring-1 ring-black ring-opacity-5 transform transition-all animate-in fade-in slide-in-from-top-2"
            >
              {/* Header Section */}
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">SIGNED IN AS</p>
                <p className="text-sm font-bold text-gray-900 truncate">{user?.email}</p>
              </div>
              
              {/* Menu Items */}
              <div className="p-2 space-y-1">
                <button 
                  onClick={() => {
                    navigate('/settings');
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center px-4 py-3 text-sm text-[#C89A4B] hover:bg-[#FDF6E9] rounded-xl transition-colors group"
                >
                  <div className="p-2 bg-[#FDF6E9] rounded-lg mr-4 group-hover:bg-white transition-colors">
                    <User className="h-5 w-5 text-[#C89A4B]" />
                  </div>
                  <span className="font-semibold text-base">Profile Settings</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors group"
                >
                  <div className="p-2 bg-red-50 rounded-lg mr-4 group-hover:bg-white transition-colors">
                    <LogOut className="h-5 w-5 text-red-600" />
                  </div>
                  <span className="font-semibold text-base">Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
