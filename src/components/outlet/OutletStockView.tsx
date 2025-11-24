import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { OutletStockItem } from '../../types/outlet';
import Table from '../ui/Table';
import { Search, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, Package } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import { toast } from 'sonner';

interface OutletStockViewProps {
  outletId: number;
}

const OutletStockView: React.FC<OutletStockViewProps> = ({ outletId }) => {
  const [items, setItems] = useState<OutletStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStock = async () => {
    setLoading(true);
    try {
      // Fetch items and calculate stock based on movements for this outlet
      // In a real app, you might have a materialized view 'outlet_stocks'
      // Here we simulate by fetching items and mocking random stock or fetching movements
      
      const { data: itemsData, error } = await supabase
        .from('items')
        .select('id, name, sku, unit, min_stock, item_categories(name)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Mocking stock calculation for demo (replace with actual RPC or movement sum)
      const processedItems: OutletStockItem[] = itemsData.map((item: any) => {
        // Random stock for demo purposes to show UI states
        const mockStock = Math.floor(Math.random() * 50); 
        let status: 'aman' | 'menipis' | 'habis' = 'aman';
        
        if (mockStock === 0) status = 'habis';
        else if (mockStock <= (item.min_stock || 10)) status = 'menipis';

        return {
          id: item.id,
          name: item.name,
          sku: item.sku || '-',
          current_stock: mockStock,
          min_stock: item.min_stock || 10,
          unit: item.unit,
          status,
          category: item.item_categories?.name
        };
      });

      setItems(processedItems);
    } catch (error: any) {
      toast.error("Gagal memuat stok outlet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [outletId]);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aman': 
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100"><CheckCircle size={12} className="mr-1"/> Aman</span>;
      case 'menipis': 
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100"><AlertTriangle size={12} className="mr-1"/> Menipis</span>;
      case 'habis': 
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100"><AlertCircle size={12} className="mr-1"/> Habis</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-2">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Package className="w-5 h-5 mr-2 text-navbar-accent-1" />
          Stok Real-time
        </h3>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari barang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
            />
          </div>
          <button onClick={fetchStock} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Nama Barang</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4 text-center">Stok</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Min. Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{item.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.category || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-bold text-base ${item.current_stock <= item.min_stock ? 'text-red-600' : 'text-gray-800'}`}>
                        {item.current_stock}
                      </span> 
                      <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500">
                      {item.min_stock}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Data stok tidak ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OutletStockView;
