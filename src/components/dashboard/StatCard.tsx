import React from 'react';
import Skeleton from '../ui/Skeleton';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  loading?: boolean;
  variant?: 'blue' | 'green' | 'purple' | 'red'; // Menambahkan varian warna
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  loading, 
  variant = 'blue' 
}) => {
  
  // Definisi skema warna modern (Electric/Bright Gradients)
  const variants = {
    blue: {
      wrapper: 'from-blue-500 to-cyan-400',
      iconBg: 'bg-blue-50 text-blue-600',
      shadow: 'shadow-blue-200',
      border: 'border-blue-100'
    },
    green: {
      wrapper: 'from-emerald-500 to-teal-400',
      iconBg: 'bg-emerald-50 text-emerald-600',
      shadow: 'shadow-emerald-200',
      border: 'border-emerald-100'
    },
    purple: {
      wrapper: 'from-violet-600 to-fuchsia-500',
      iconBg: 'bg-violet-50 text-violet-600',
      shadow: 'shadow-violet-200',
      border: 'border-violet-100'
    },
    red: {
      wrapper: 'from-rose-500 to-orange-400',
      iconBg: 'bg-rose-50 text-rose-600',
      shadow: 'shadow-rose-200',
      border: 'border-rose-100'
    }
  };

  const theme = variants[variant];

  return (
    <div className={`relative overflow-hidden bg-white rounded-2xl p-6 border ${theme.border} shadow-lg hover:shadow-xl transition-all duration-300 group`}>
      {/* Background Decoration (Glow Effect) */}
      <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br ${theme.wrapper} rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500`}></div>
      
      <div className="relative z-10 flex items-center">
        {/* Icon Container */}
        <div className={`p-4 rounded-2xl ${theme.iconBg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="w-7 h-7" strokeWidth={2} />
        </div>
        
        <div className="ml-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
          {loading ? (
            <Skeleton className="h-8 w-32 mt-1" />
          ) : (
            <p className="text-3xl font-bold text-gray-800 tracking-tight mt-1">
              {value}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Active Line */}
      <div className={`absolute bottom-0 left-0 h-1 w-0 group-hover:w-full bg-gradient-to-r ${theme.wrapper} transition-all duration-500 ease-out`}></div>
    </div>
  );
};

export default StatCard;
