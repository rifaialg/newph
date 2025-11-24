import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Search, ChevronLeft, ChevronRight, Calendar, FileText, User } from 'lucide-react';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

interface AdjustmentHistoryItem {
  id: number;
  created_at: string;
  item_id: number;
  quantity_change: number;
  note: string;
  items: {
    name: string;
    sku: string;
    unit: string;
  };
  users: {
    full_name: string;
  };
}

const ManualAdjustmentHistory: React.FC = () => {
  const [adjustments, setAdjustments] = useState<AdjustmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          id,
          created_at,
          item_id,
          quantity_change,
          note,
          items (name, sku, unit),
          users (full_name)
        `)
        .eq('movement_type', 'manual_adjustment')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setAdjustments(data as any[]);
    } catch (error: any) {
      toast.error(`Gagal memuat riwayat penyesuaian: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  const filteredData = adjustments.filter((item) =>
    item.items.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.items.sku && item.items.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  const getVarianceColor = (val: number) => {
    if (val > 0) return 'text-green-600';
    if (val < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className="mt-10">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-sidebar-accent" />
          Riwayat Penyesuaian Manual
        </h2>
        
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari barang..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-navbar-accent-1 focus:border-navbar-accent-1 bg-white text-gray-900 transition-shadow duration-300 focus:shadow-glow-gold"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
            <tr>
              <th className="px-6 py-4">Tanggal Transaksi</th>
              <th className="px-6 py-4">Nama Produk / SKU</th>
              <th className="px-6 py-4 text-center">Selisih (Adj)</th>
              <th className="px-6 py-4">Alasan / Catatan</th>
              <th className="px-6 py-4">Oleh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-6 py-4"><Skeleton className="h-6 w-full" /></td>
                </tr>
              ))
            ) : currentItems.length > 0 ? (
              currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-900">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      {new Date(item.created_at).toLocaleDateString('id-ID')}
                      <span className="text-xs text-gray-500 ml-2">
                        {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{item.items.name}</div>
                    <div className="text-xs text-gray-500">{item.items.sku || '-'}</div>
                  </td>
                  <td className={`px-6 py-4 text-center font-bold ${getVarianceColor(item.quantity_change)}`}>
                    {item.quantity_change > 0 ? '+' : ''}{item.quantity_change} <span className="text-xs font-normal text-gray-500">{item.items.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 italic">
                    "{item.note}"
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                     <div className="flex items-center">
                        <User className="w-3 h-3 mr-1 text-gray-400" />
                        {item.users?.full_name || 'System'}
                     </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  Tidak ada data penyesuaian manual.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && filteredData.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-700">
              Hal. <span className="font-medium">{currentPage}</span> dari <span className="font-medium">{totalPages}</span>
            </span>
            <div className="flex space-x-2">
              <button onClick={prevPage} disabled={currentPage === 1} className="p-1 border rounded-md bg-white disabled:opacity-50 hover:bg-gray-50">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextPage} disabled={currentPage === totalPages} className="p-1 border rounded-md bg-white disabled:opacity-50 hover:bg-gray-50">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards View */}
      <div className="block lg:hidden space-y-4">
        {loading ? (
           <Skeleton className="h-32 w-full" />
        ) : currentItems.length > 0 ? (
          currentItems.map((item) => (
            <Card key={item.id} className="p-4 border-l-4 border-sidebar-accent">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-900">{item.items.name}</p>
                  <p className="text-xs text-gray-500">{item.items.sku || 'No SKU'}</p>
                </div>
                <span className={`text-sm font-bold ${getVarianceColor(item.quantity_change)}`}>
                  {item.quantity_change > 0 ? '+' : ''}{item.quantity_change} {item.items.unit}
                </span>
              </div>
              
              <div className="text-xs text-gray-500 mb-2 flex items-center">
                 <Calendar className="w-3 h-3 mr-1" />
                 {new Date(item.created_at).toLocaleDateString('id-ID')} • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>

              <div className="bg-gray-50 p-2 rounded text-sm text-gray-700 italic mb-2">
                "{item.note}"
              </div>

              <div className="text-xs text-gray-400 flex items-center justify-end">
                <User className="w-3 h-3 mr-1" /> {item.users?.full_name || 'System'}
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center p-8 text-gray-500 bg-white rounded-lg border border-dashed">
            Tidak ada data.
          </div>
        )}
        
        {/* Mobile Pagination */}
        {!loading && filteredData.length > 0 && (
          <div className="flex justify-center space-x-4 mt-4">
            <button onClick={prevPage} disabled={currentPage === 1} className="px-4 py-2 bg-white border rounded-md disabled:opacity-50">Prev</button>
            <span className="py-2 text-sm text-gray-500">Page {currentPage}</span>
            <button onClick={nextPage} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border rounded-md disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualAdjustmentHistory;
