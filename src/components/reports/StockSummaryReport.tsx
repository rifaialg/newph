import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { 
  Search, Download, RefreshCw, Package, Layers, 
  TrendingDown, DollarSign, Filter, MoreHorizontal, 
  ArrowUpDown, AlertCircle, CheckCircle, AlertTriangle,
  ChefHat, Zap
} from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import { exportToCsv } from '../../utils/export';

// --- Interfaces ---
interface StockItem {
  id: number;
  name: string;
  sku: string;
  category_name: string;
  unit: string;
  cost_price: number; // HPP
  selling_price: number;
  min_stock: number;
  current_stock: number;
  stock_value: number;
  status: 'aman' | 'menipis' | 'habis';
}

const StockSummaryReport: React.FC = () => {
  // --- State ---
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'finished' | 'raw'>('finished'); // 'finished' = Produk Jadi, 'raw' = Bahan Baku
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // --- Data Fetching ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Items & Categories
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select(`
          id, name, sku, unit, cost_price, selling_price, min_stock,
          item_categories (name)
        `)
        .eq('is_active', true)
        .order('name');

      if (itemsError) throw itemsError;

      // 2. Fetch Stock Movements (Calculated Source of Truth)
      const { data: movements, error: movError } = await supabase
        .from('stock_movements')
        .select('item_id, quantity_change');

      if (movError) throw movError;

      // 3. Calculate Stock Map
      const stockMap = new Map<number, number>();
      movements?.forEach(m => {
        const current = stockMap.get(m.item_id) || 0;
        stockMap.set(m.item_id, current + m.quantity_change);
      });

      // 4. Process Data
      const processedItems: StockItem[] = (itemsData as any[]).map(item => {
        const currentStock = stockMap.get(item.id) || 0;
        const minStock = item.min_stock || 0;
        
        let status: 'aman' | 'menipis' | 'habis' = 'aman';
        if (currentStock <= 0) status = 'habis';
        else if (currentStock <= minStock) status = 'menipis';

        return {
          id: item.id,
          name: item.name,
          sku: item.sku || '-',
          category_name: item.item_categories?.name || 'Uncategorized',
          unit: item.unit,
          cost_price: item.cost_price || 0,
          selling_price: item.selling_price || 0,
          min_stock: minStock,
          current_stock: currentStock,
          stock_value: currentStock * (item.cost_price || 0),
          status
        };
      });

      setItems(processedItems);

    } catch (error: any) {
      console.error("Error fetching stock:", error);
      toast.error("Gagal memuat data stok.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Filtering Logic ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Tab Filter
      const isRawMaterial = item.category_name.toLowerCase().includes('bahan baku');
      if (activeTab === 'finished' && isRawMaterial) return false;
      if (activeTab === 'raw' && !isRawMaterial) return false;

      // Search Filter
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
      );
    });
  }, [items, activeTab, searchQuery]);

  // --- Metrics Calculation ---
  const metrics = useMemo(() => {
    const totalVariants = filteredItems.length;
    const totalUnits = filteredItems.reduce((sum, item) => sum + Math.max(0, item.current_stock), 0);
    const lowStockCount = filteredItems.filter(item => item.status !== 'aman').length;
    const totalValue = filteredItems.reduce((sum, item) => sum + Math.max(0, item.stock_value), 0);

    return { totalVariants, totalUnits, lowStockCount, totalValue };
  }, [filteredItems]);

  // --- Pagination ---
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- Export ---
  const handleExport = () => {
    const dataToExport = filteredItems.map(item => ({
      'Nama Produk': item.name,
      'SKU': item.sku,
      'Kategori': item.category_name,
      'Stok Saat Ini': item.current_stock,
      'Satuan': item.unit,
      'HPP': item.cost_price,
      'Nilai Stok': item.stock_value,
      'Status': item.status
    }));
    exportToCsv(`Laporan_Stok_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`, dataToExport);
  };

  // --- UI Components ---
  
  const MetricCard = ({ title, value, icon: Icon, colorClass, iconBgClass }: any) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow duration-300">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>
        )}
      </div>
      <div className={`p-3 rounded-xl ${iconBgClass} ${colorClass}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const config = {
      aman: { color: 'bg-green-50 text-green-700 border-green-100', icon: CheckCircle, label: 'Aman' },
      menipis: { color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: AlertTriangle, label: 'Menipis' },
      habis: { color: 'bg-red-50 text-red-700 border-red-100', icon: AlertCircle, label: 'Habis' }
    };
    const style = config[status as keyof typeof config];
    const Icon = style.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${style.color}`}>
        <Icon size={12} className="mr-1.5" />
        {style.label}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      
      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Manajemen Stok</h1>
        <p className="text-gray-500">Lacak inventaris produk Anda dan lihat riwayat pergerakan stok secara real-time.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard 
          title={activeTab === 'finished' ? "Total Varian Produk Jadi" : "Total Varian Bahan Baku"}
          value={metrics.totalVariants}
          icon={Package}
          colorClass="text-purple-600"
          iconBgClass="bg-purple-100"
        />
        <MetricCard 
          title="Total Unit Stok"
          value={metrics.totalUnits.toLocaleString('id-ID')}
          icon={Layers}
          colorClass="text-emerald-600"
          iconBgClass="bg-emerald-100"
        />
        <MetricCard 
          title="Produk Stok Rendah"
          value={metrics.lowStockCount}
          icon={TrendingDown}
          colorClass="text-orange-600"
          iconBgClass="bg-orange-100"
        />
        <MetricCard 
          title="Nilai Aset Stok"
          value={`Rp ${metrics.totalValue.toLocaleString('id-ID', { notation: 'compact', maximumFractionDigits: 1 })}`}
          icon={DollarSign}
          colorClass="text-blue-600"
          iconBgClass="bg-blue-100"
        />
      </div>

      {/* Main Content Card */}
      <Card className="p-0 overflow-hidden border border-gray-200 shadow-lg rounded-2xl">
        
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 bg-white flex flex-col xl:flex-row justify-between items-center gap-4">
          
          {/* Tabs */}
          <div className="bg-gray-100 p-1 rounded-lg flex w-full xl:w-auto">
            <button
              onClick={() => { setActiveTab('finished'); setCurrentPage(1); }}
              className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex-1 xl:flex-none ${
                activeTab === 'finished' 
                  ? 'bg-green-500 text-white shadow-md' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              Produk Jadi
            </button>
            <button
              onClick={() => { setActiveTab('raw'); setCurrentPage(1); }}
              className={`px-6 py-2 rounded-md text-sm font-bold transition-all flex-1 xl:flex-none ${
                activeTab === 'raw' 
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              Bahan Baku
            </button>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-3">
            <div className="relative flex-grow sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Cari ${activeTab === 'finished' ? 'produk jadi' : 'bahan baku'}...`}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Button variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-transparent text-xs font-bold px-4 whitespace-nowrap">
                <Zap size={16} className="mr-2" /> Analisis Stok
              </Button>
              {activeTab === 'finished' && (
                <Button variant="secondary" className="bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-100 text-xs font-bold px-4 whitespace-nowrap">
                  <ChefHat size={16} className="mr-2" /> Kelola Resep
                </Button>
              )}
              <Button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 text-white border-transparent text-xs font-bold px-4 whitespace-nowrap shadow-blue-200 shadow-lg">
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Sinkronisasi
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input type="checkbox" className="rounded border-gray-300 text-navbar-accent-1 focus:ring-navbar-accent-1" />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors group">
                  <div className="flex items-center">Produk <ArrowUpDown size={12} className="ml-1 opacity-0 group-hover:opacity-50" /></div>
                </th>
                <th className="px-6 py-4 text-center">Stok Saat Ini</th>
                <th className="px-6 py-4 text-right">HPP (Rp)</th>
                {activeTab === 'finished' && <th className="px-6 py-4 text-right">Harga Jual (Rp)</th>}
                <th className="px-6 py-4 text-center">Ambang Batas</th>
                <th className="px-6 py-4 text-right">Nilai Stok</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-4" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    {activeTab === 'finished' && <td className="px-6 py-4"><Skeleton className="h-4 w-24 ml-auto" /></td>}
                    <td className="px-6 py-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24 ml-auto" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-20 mx-auto rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-8 w-8 mx-auto rounded-lg" /></td>
                  </tr>
                ))
              ) : paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <input type="checkbox" className="rounded border-gray-300 text-navbar-accent-1 focus:ring-navbar-accent-1" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{item.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-gray-800">{item.current_stock}</span> <span className="text-xs text-gray-500">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {item.cost_price.toLocaleString('id-ID')}
                    </td>
                    {activeTab === 'finished' && (
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {item.selling_price.toLocaleString('id-ID')}
                      </td>
                    )}
                    <td className="px-6 py-4 text-center text-gray-500">
                      {item.min_stock}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">
                      {item.stock_value.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={activeTab === 'finished' ? 9 : 8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-gray-50 p-4 rounded-full mb-3">
                        <Package className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-medium">Belum ada produk. Silakan tambahkan produk baru.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            Menampilkan <span className="font-bold text-gray-800">{paginatedItems.length}</span> dari <span className="font-bold text-gray-800">{filteredItems.length}</span> data
          </p>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                &lt;
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                &gt;
              </button>
            </div>
            
            <select 
              className="bg-white border border-gray-200 text-gray-600 text-sm rounded-lg focus:ring-navbar-accent-1 focus:border-navbar-accent-1 block p-2 cursor-pointer"
              value={itemsPerPage}
              disabled
            >
              <option>20 / halaman</option>
            </select>
          </div>
        </div>

      </Card>
    </div>
  );
};

export default StockSummaryReport;
