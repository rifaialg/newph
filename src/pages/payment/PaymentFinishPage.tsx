import React from 'react';
import { Navigate } from 'react-router-dom';

// Redirect legacy route to dashboard
const PaymentFinishPage: React.FC = () => {
  return <Navigate to="/dashboard" replace />;
};

export default PaymentFinishPage;
