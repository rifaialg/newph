import React from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';

interface StatusToggleProps {
  isActive: boolean;
  onToggle: () => void;
  className?: string;
}

const StatusToggle: React.FC<StatusToggleProps> = ({ isActive, onToggle, className = '' }) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`
        transition-colors duration-300 ease-in-out rounded-full p-1
        focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-navbar-accent-1
        ${isActive ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-gray-500'}
        ${className}
      `}
      aria-label={isActive ? "Deactivate" : "Activate"}
      title={isActive ? "Set to Inactive" : "Set to Active"}
    >
      {isActive ? (
        <ToggleRight className="w-6 h-6" strokeWidth={2} />
      ) : (
        <ToggleLeft className="w-6 h-6" strokeWidth={2} />
      )}
    </button>
  );
};

export default StatusToggle;
