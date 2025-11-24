import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Outlet } from '../../types/database';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import SpotlightMenu, { MenuItem } from '../../components/ui/SpotlightMenu';
import { 
  LayoutDashboard, Package, ShoppingBag, Truck, 
  ClipboardList, BarChart3, ArrowLeft, Store 
} from 'lucide-react';
import { toast } from 'sonner';

// Sub-components
import OutletDashboardPage from './OutletDashboardPage'; // Reuse existing dashboard logic
import OutletStockView from '../../components/outlet/OutletStockView';
import OutletSalesView from '../../components/outlet/OutletSalesView';
import OutletRequestForm from '../../components/outlet/OutletRequestForm';

type ViewMode = 'dashboard' | 'stock' | 'sales' | 'request' | 'opname' | 'reports';

const OutletDetailView: React.FC = () => {
  const { outletId } = useParams<{ outletId: string }>();
  const navigate = useNavigate();
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [activeTab, setActiveTab] = useState<ViewMode>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOutletDetails = async () => {
      if (!outletId) return;
      try {
        const { data, error } = await supabase
          .from('outlets')
          .select('*')
          .eq('id', outletId)
          .single();

        if (error) throw error;
        setOutlet(data);
      } catch (error) {
        toast.error("Outlet tidak ditemukan.");
        navigate('/outlet');
      } finally {
        setLoading(false);
      }
    };

    fetchOutletDetails();
  }, [outletId, navigate]);

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard Outlet', icon: LayoutDashboard, description: 'Ringkasan performa & metrik.' },
    { id: 'stock', label: 'Stok Outlet', icon: Package, description: 'Monitor inventaris real-time.' },
    { id: 'sales', label: 'Penjualan', icon: ShoppingBag, description: 'Riwayat transaksi penjualan.' },
    { id: 'request', label: 'Permintaan Barang', icon: Truck, description: 'Request stok ke Pusat (PH).' },
    { id: 'opname', label: 'Stok Opname', icon: ClipboardList, description: 'Audit stok fisik outlet.' },
    { id: 'reports', label: 'Laporan', icon: BarChart3, description: 'Laporan laba rugi outlet.' },
  ];

  if (loading) return <div className="p-8 text-center">Memuat data outlet...</div>;
  if (!outlet) return null;

  const renderContent = () => {
    switch (activeTab) {
        case 'dashboard': return <OutletDashboardPage />; // Pass outletId prop if needed
        case 'stock': return <OutletStockView outletId={outlet.id} />;
        case 'sales': return <OutletSalesView outletId={outlet.id} />;
        case 'request': return <OutletRequestForm outletId={outlet.id} />;
        default: return (
            <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <p className="text-gray-500 font-medium">Fitur ini sedang dalam pengembangan.</p>
            </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header with Back Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1 cursor-pointer hover:text-navbar-accent-1 transition-colors" onClick={() => navigate('/outlet')}>
                <ArrowLeft size={14} />
                <span>Kembali ke Daftar Outlet</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Store className="w-6 h-6 mr-2 text-navbar-accent-1" />
                {outlet.name}
            </h1>
            <p className="text-sm text-gray-500 ml-8">{outlet.address || 'Cabang Artirasa'}</p>
        </div>
        
        <div className="flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${outlet.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {outlet.is_active ? 'OPERASIONAL' : 'NON-AKTIF'}
            </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 flex-shrink-0">
            <SpotlightMenu 
                title="Menu Outlet"
                items={menuItems}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as ViewMode)}
            />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
            {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default OutletDetailView;
