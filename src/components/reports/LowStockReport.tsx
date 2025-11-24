import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import Table from '../ui/Table';
import { Download, AlertTriangle } from 'lucide-react';
import Button from '../ui/Button';
import { exportToCsv } from '../../utils/export';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const LowStockReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_low_stock_items');
      if (error) toast.error(error.message);
      else setData(data);
      setLoading(false);
    };
    fetchReport();
  }, []);

  const handleExport = () => {
    exportToCsv('low_stock_report.csv', data);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-red-50 rounded-lg mr-3">
            <AlertTriangle className="text-red-500 w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Low Stock Alerts</h3>
        </div>
        <Button onClick={handleExport} variant="secondary" className="flex items-center text-sm bg-white border border-gray-200 hover:bg-gray-50">
          <Download size={16} className="mr-2" /> Export CSV
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block rounded-lg border border-gray-100 overflow-hidden">
        <Table
          headers={['Item Name', 'SKU', 'Current Qty', 'Min. Threshold', 'Status']}
          loading={loading}
          emptyStateMessage="Good news! No items are currently low on stock."
        >
          {data.map((row) => (
            <tr key={row.item_id} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-none">
              <td className="px-6 py-4 font-semibold text-gray-900">{row.item_name}</td>
              <td className="px-6 py-4 text-gray-500 font-mono text-xs">{row.item_sku || '-'}</td>
              <td className="px-6 py-4">
                <span className="text-red-600 font-bold">{row.current_quantity}</span> <span className="text-gray-400 text-xs">{row.unit}</span>
              </td>
              <td className="px-6 py-4 text-gray-600">
                {row.min_stock_level} <span className="text-gray-400 text-xs">{row.unit}</span>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-600/10">
                  Low Stock
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="block lg:hidden space-y-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.map((row) => (
              <Card key={row.item_id} className="p-5 border-l-4 border-red-500 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-lg text-gray-900">{row.item_name}</h4>
                  <span className="px-2 py-1 text-xs font-bold bg-red-50 text-red-600 rounded-md">Low</span>
                </div>
                <p className="text-xs text-gray-500 font-mono mb-4">{row.item_sku || 'No SKU'}</p>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Current</p>
                    <p className="font-bold text-lg text-red-600">{row.current_quantity} <span className="text-sm font-normal text-gray-500">{row.unit}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Min. Limit</p>
                    <p className="font-semibold text-lg text-gray-700">{row.min_stock_level} <span className="text-sm font-normal text-gray-500">{row.unit}</span></p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center p-12 bg-green-50 rounded-xl border border-dashed border-green-200">
            <p className="text-green-700 font-medium">All stock levels are healthy!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LowStockReport;
