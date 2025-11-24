import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center spotlight-bg animate-spotlight">
      <Outlet />
    </div>
  );
};

export default AuthLayout;
