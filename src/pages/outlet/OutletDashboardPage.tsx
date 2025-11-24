import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import OutletPnLSummary from '../../components/outlet/OutletPnLSummary';
import OutletSalesAnalytics from '../../components/outlet/OutletSalesAnalytics';
import OutletStockSummary from '../../components/outlet/OutletStockSummary';
import { OutletStockItem, SalesDataPoint, PnLMetrics } from '../../types/outlet';
import { Store } from 'lucide-react';
import { toast } from 'sonner';

const OutletDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [pnlData, setPnlData] = useState<PnLMetrics | undefined>(undefined);
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [stockData, setStockData] = useState<OutletStockItem[]>([]);

  useEffect(() => {
    // Simulasi Fetch Data
    // Di implementasi nyata, gunakan Supabase dengan filter outlet_id user yang sedang login
    const fetchOutletData = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

        // Mock Data PnL
        setPnlData({
          revenue: 15400000,
          cogs: 6500000,
          operational_cost: 2500000,
          net_profit: 6400000,
          trend_revenue: 12.5,
          trend_profit: 8.2
        });

        // Mock Data Sales (7 Days)
        const mockSales = Array.from({ length: 7 }).map((_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          return {
            date: date.toISOString(),
            total_sales: Math.floor(Math.random() * 2000000) + 1000000,
            transaction_count: Math.floor(Math.random() * 50) + 20
          };
        });
        setSalesData(mockSales);

        // Mock Data Stock
        setStockData([
          { id: 1, name: 'Kopi Arabica', sku: 'AR-COF-001', current_stock: 15, min_stock: 5, unit: 'kg', status: 'aman' },
          { id: 2, name: 'Susu UHT', sku: 'AR-MLK-002', current_stock: 4, min_stock: 10, unit: 'ltr', status: 'menipis' },
          { id: 3, name: 'Sirup Vanilla', sku: 'AR-SYR-003', current_stock: 0, min_stock: 2, unit: 'btl', status: 'habis' },
          { id: 4, name: 'Cup 12oz', sku: 'AR-PKG-004', current_stock: 500, min_stock: 100, unit: 'pcs', status: 'aman' },
          { id: 5, name: 'Gula Aren', sku: 'AR-SUG-005', current_stock: 8, min_stock: 5, unit: 'kg', status: 'aman' },
        ]);

      } catch (error) {
        toast.error("Gagal memuat data outlet.");
      } finally {
        setLoading(false);
      }
    };

    fetchOutletData();
  }, []);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Manajemen Outlet">
        <div className="flex items-center text-sm text-gray-500 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
          <Store className="w-4 h-4 mr-2 text-navbar-accent-1" />
          <span>Artirasa Joglo (Cabang Utama)</span>
        </div>
      </PageHeader>

      {/* 1. Profit & Loss Summary Cards */}
      <OutletPnLSummary data={pnlData} loading={loading} />

      {/* 2. Main Grid: Analytics & Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Analytics (Takes up 2 columns on large screens) */}
        <div className="lg:col-span-2">
          <OutletSalesAnalytics data={salesData} loading={loading} />
        </div>

        {/* Stock Summary (Takes up 1 column) */}
        <div className="lg:col-span-1">
          <OutletStockSummary items={stockData} loading={loading} />
        </div>

      </div>
    </div>
  );
};

export default OutletDashboardPage;
