import React from 'react';
import { ShoppingBag, Calendar, User } from 'lucide-react';
import Card from '../ui/Card';

// Placeholder component for Sales View
const OutletSalesView: React.FC<{ outletId: number }> = ({ outletId }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <ShoppingBag className="w-5 h-5 mr-2 text-navbar-accent-1" />
          Riwayat Penjualan
        </h3>
      </div>

      <Card className="p-12 text-center border-dashed border-2 border-gray-200 bg-gray-50">
        <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
          <ShoppingBag className="text-gray-300" size={32} />
        </div>
        <h4 className="text-lg font-semibold text-gray-700">Modul Penjualan</h4>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          Fitur pencatatan transaksi POS (Point of Sale) dan riwayat penjualan outlet akan ditampilkan di sini.
        </p>
        <p className="text-xs text-gray-400 mt-4">Outlet ID: {outletId}</p>
      </Card>
    </div>
  );
};

export default OutletSalesView;
