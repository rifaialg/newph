import React, { useState } from 'react';
import { BarChart3, History, AlertTriangle, ShoppingBag, PieChart } from 'lucide-react';
import AnalyticsDashboard from './AnalyticsDashboard';
import StockSummaryReport from './StockSummaryReport';
import ManualAdjustmentReport from './ManualAdjustmentReport';
import LowStockReport from './LowStockReport';
import OutletOrderReport from './OutletOrderReport';
import SpotlightMenu, { MenuItem } from '../ui/SpotlightMenu';

type ReportTab = 'analytics' | 'stock_summary' | 'opname_history' | 'low_stock' | 'outlet_orders';

const ProductionHouseView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('analytics');

  const menuItems: MenuItem[] = [
    { 
      id: 'analytics', 
      label: 'Dashboard Analitik', 
      icon: PieChart, 
      description: 'Ringkasan performa & arus kas.' 
    },
    { 
      id: 'stock_summary', 
      label: 'Ringkasan Stok', 
      icon: BarChart3, 
      description: 'Laporan inventaris lengkap.' 
    },
    { 
      id: 'outlet_orders', 
      label: 'Pesanan Outlet', 
      icon: ShoppingBag, 
      description: 'Permintaan stok masuk.' 
    },
    { 
      id: 'opname_history', 
      label: 'Riwayat Opname', 
      icon: History, 
      description: 'Log penyesuaian stok.' 
    },
    { 
      id: 'low_stock', 
      label: 'Peringatan Stok', 
      icon: AlertTriangle, 
      description: 'Monitoring stok menipis.' 
    },
  ];

  const renderActiveReport = () => {
    switch (activeTab) {
      case 'analytics': return <AnalyticsDashboard />;
      case 'stock_summary': return <StockSummaryReport />;
      case 'opname_history': return <ManualAdjustmentReport />;
      case 'low_stock': return <LowStockReport />;
      case 'outlet_orders': return <OutletOrderReport />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
      {/* Left Sidebar Navigation */}
      <div className="w-full lg:w-64 flex-shrink-0">
        <SpotlightMenu 
          title="Menu Laporan"
          items={menuItems}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as ReportTab)}
        />
      </div>

      {/* Right Content Area */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[600px]">
          {renderActiveReport()}
        </div>
      </div>
    </div>
  );
};

export default ProductionHouseView;
