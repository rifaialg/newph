import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import AuthLayout from './components/layout/AuthLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import MainLayout from './components/layout/MainLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import ItemsPage from './pages/inventory/ItemsPage';
import IncomingStockPage from './pages/inventory/IncomingStockPage';
import OutcomingStockPage from './pages/inventory/OutcomingStockPage';
import SessionsPage from './pages/opname/SessionsPage';
import OpnameCountPage from './pages/opname/OpnameCountPage';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import CreateAdjustmentPage from './pages/opname/CreateAdjustmentPage';
import HPPCalculatorPage from './pages/calculator/HPPCalculatorPage';

// Outlet Module
import OutletSelectionPage from './pages/outlet/OutletSelectionPage';
import OutletDetailView from './pages/outlet/OutletDetailView';

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/auth/login" replace />;
  }
  return <>{children}</>;
};

const GuestGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthGuard><MainLayout /></AuthGuard>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      
      // Inventory
      { path: 'inventory/incoming', element: <IncomingStockPage /> },
      { path: 'inventory/outgoing', element: <OutcomingStockPage /> },
      { path: 'inventory/items', element: <ItemsPage /> },
      
      // Opname
      { path: 'opname/sessions', element: <SessionsPage /> },
      { path: 'opname/create', element: <CreateAdjustmentPage /> },
      { path: 'opname/session/:id', element: <OpnameCountPage /> },
      
      // Calculator
      { path: 'calculator/hpp', element: <HPPCalculatorPage /> },
      
      // Outlet Management (UPDATED)
      { path: 'outlet', element: <OutletSelectionPage /> },
      { path: 'outlet/:outletId/dashboard', element: <OutletDetailView /> },

      // Others
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '/auth',
    element: <GuestGuard><AuthLayout /></GuestGuard>,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
