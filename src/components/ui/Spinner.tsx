import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'primary';
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'white' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const colorClasses = {
    white: 'border-white',
    primary: 'border-navbar-accent-1',
  };

  return (
    <div
      className={`animate-spin rounded-full ${sizeClasses[size]} border-b-2 ${colorClasses[color]}`}
    ></div>
  );
};

export default Spinner;
