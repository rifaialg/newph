import React from 'react';
import Card from '../ui/Card';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { PnLMetrics } from '../../types/outlet';
import Skeleton from '../ui/Skeleton';

interface OutletPnLSummaryProps {
  data?: PnLMetrics;
  loading?: boolean;
}

const OutletPnLSummary: React.FC<OutletPnLSummaryProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Default values if data is missing
  const metrics = data || {
    revenue: 0,
    cogs: 0,
    operational_cost: 0,
    net_profit: 0,
    trend_revenue: 0,
    trend_profit: 0
  };

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Revenue Card */}
      <Card className="p-5 border-l-4 border-l-blue-500 relative overflow-hidden group hover:shadow-glow-gold transition-all duration-300">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <DollarSign size={60} className="text-blue-600" />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Pendapatan</p>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.revenue)}</h3>
          
          <div className="flex items-center mt-3 text-xs">
            <span className={`flex items-center font-bold ${metrics.trend_revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.trend_revenue >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
              {Math.abs(metrics.trend_revenue)}%
            </span>
            <span className="text-gray-400 ml-1">vs bulan lalu</span>
          </div>
        </div>
      </Card>

      {/* Expense Card */}
      <Card className="p-5 border-l-4 border-l-red-500 relative overflow-hidden group hover:shadow-glow-gold transition-all duration-300">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Activity size={60} className="text-red-600" />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Pengeluaran</p>
          <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.cogs + metrics.operational_cost)}</h3>
          
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>HPP (COGS):</span>
              <span className="font-medium text-gray-700">{formatCurrency(metrics.cogs)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Operasional:</span>
              <span className="font-medium text-gray-700">{formatCurrency(metrics.operational_cost)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Net Profit Card */}
      <Card className="p-5 border-l-4 border-l-navbar-accent-1 bg-gradient-to-br from-white to-amber-50/30 relative overflow-hidden group hover:shadow-glow-gold transition-all duration-300">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Wallet size={60} className="text-navbar-accent-1" />
        </div>
        <div className="relative z-10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Laba Bersih (Net Profit)</p>
          <h3 className={`text-2xl font-bold ${metrics.net_profit >= 0 ? 'text-navbar-accent-1' : 'text-red-600'}`}>
            {formatCurrency(metrics.net_profit)}
          </h3>
          
          <div className="flex items-center mt-3 text-xs">
            <span className={`flex items-center font-bold ${metrics.trend_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metrics.trend_profit >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
              {Math.abs(metrics.trend_profit)}%
            </span>
            <span className="text-gray-400 ml-1">margin keuntungan</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OutletPnLSummary;
