import React, { useRef, useState, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

interface SpotlightMenuProps {
  title?: string;
  items: MenuItem[];
  activeTab: string;
  onTabChange: (id: any) => void;
  className?: string;
}

const SpotlightMenu: React.FC<SpotlightMenuProps> = ({ 
  title = "Menu", 
  items, 
  activeTab, 
  onTabChange,
  className = ""
}) => {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-24 ${className}`}>
      <div className="p-4 bg-gray-50/50 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      <nav className="p-2 space-y-1">
        {items.map((item) => (
          <SpotlightItem
            key={item.id}
            item={item}
            isActive={activeTab === item.id}
            onClick={() => onTabChange(item.id)}
          />
        ))}
      </nav>
    </div>
  );
};

const SpotlightItem: React.FC<{
  item: MenuItem;
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => {
  const divRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!divRef.current) return;

    const div = divRef.current;
    const rect = div.getBoundingClientRect();

    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setOpacity(1);
  };

  const handleBlur = () => {
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  const Icon = item.icon;

  return (
    <button
      ref={divRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 text-left group overflow-hidden
        ${isActive 
          ? 'bg-navbar-accent-1 text-white shadow-md shadow-navbar-accent-1/20' 
          : 'text-gray-600 hover:text-gray-900'
        }
      `}
    >
      {/* Spotlight Effect Overlay (Desktop) */}
      {!isActive && (
        <div
          className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            opacity,
            background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(200, 154, 75, 0.08), transparent 40%)`,
          }}
        />
      )}
      
      {/* Border Spotlight */}
      {!isActive && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            opacity,
            border: '1px solid transparent',
            maskImage: `radial-gradient(30% 30% at ${position.x}px ${position.y}px, black 45%, transparent)`,
            WebkitMaskImage: `radial-gradient(30% 30% at ${position.x}px ${position.y}px, black 45%, transparent)`,
            borderColor: 'rgba(200, 154, 75, 0.4)'
          }}
        />
      )}

      {/* Content */}
      <div className={`
        relative z-10 p-2.5 rounded-lg mr-3 transition-colors duration-300
        ${isActive 
          ? 'bg-white/20 text-white' 
          : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-navbar-accent-1 group-hover:shadow-sm'
        }
      `}>
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
      </div>
      
      <div className="relative z-10 flex-1">
        <span className={`block font-bold text-sm ${isActive ? 'text-white' : 'text-gray-700 group-hover:text-navbar-accent-1'}`}>
          {item.label}
        </span>
        {item.description && (
          <span className={`block text-[10px] mt-0.5 font-medium ${isActive ? 'text-white/80' : 'text-gray-400 group-hover:text-gray-500'}`}>
            {item.description}
          </span>
        )}
      </div>
    </button>
  );
};

export default SpotlightMenu;
