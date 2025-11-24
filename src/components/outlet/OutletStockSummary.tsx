import React from 'react';
import Card from '../ui/Card';
import { OutletStockItem } from '../../types/outlet';
import { Package, AlertTriangle, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import Skeleton from '../ui/Skeleton';

interface OutletStockSummaryProps {
  items?: OutletStockItem[];
  loading?: boolean;
}

const OutletStockSummary: React.FC<OutletStockSummaryProps> = ({ items, loading }) => {
  if (loading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const stockItems = items || [];
  const lowStockCount = stockItems.filter(i => i.status !== 'aman').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aman': 
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-100"><CheckCircle size={10} className="mr-1"/> Aman</span>;
      case 'menipis': 
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-50 text-yellow-700 border border-yellow-100"><AlertTriangle size={10} className="mr-1"/> Menipis</span>;
      case 'habis': 
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100"><AlertCircle size={10} className="mr-1"/> Habis</span>;
      default: return null;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Package className="w-5 h-5 mr-2 text-navbar-accent-1" />
            Ringkasan Stok
          </h3>
          <p className="text-xs text-gray-500 mt-1">Status inventaris real-time</p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
            <span className="text-xs font-bold text-red-700">{lowStockCount} Item Perlu Restock</span>
          </div>
        )}
      </div>

      <div className="flex-grow overflow-hidden border border-gray-100 rounded-xl">
        <div className="overflow-y-auto max-h-[320px] custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-center">Stok</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stockItems.length > 0 ? (
                stockItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-800">{item.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${item.current_stock <= item.min_stock ? 'text-red-600' : 'text-gray-800'}`}>
                        {item.current_stock}
                      </span> 
                      <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(item.status)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                    Data stok tidak tersedia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 pt-2 text-right">
        <button className="text-xs font-bold text-navbar-accent-1 hover:text-navbar-accent-2 flex items-center justify-end transition-colors">
          Lihat Semua Stok <ArrowRight size={14} className="ml-1" />
        </button>
      </div>
    </Card>
  );
};

export default OutletStockSummary;
