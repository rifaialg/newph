import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import Table from '../ui/Table';
import { Download, Search, Calendar, User, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import { exportToCsv } from '../../utils/export';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

interface AdjustmentReportItem {
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

const ManualAdjustmentReport: React.FC = () => {
  const [data, setData] = useState<AdjustmentReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchReport = useCallback(async () => {
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

      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data: result, error } = await query;

      if (error) throw error;
      setData(result as any[]);
    } catch (error: any) {
      toast.error(`Gagal memuat laporan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExport = () => {
    const exportData = data.map(item => ({
      Date: new Date(item.created_at).toLocaleDateString('id-ID'),
      Time: new Date(item.created_at).toLocaleTimeString('id-ID'),
      Item: item.items.name,
      SKU: item.items.sku || '-',
      Adjustment: item.quantity_change,
      Unit: item.items.unit,
      Note: item.note,
      User: item.users?.full_name || 'System'
    }));
    exportToCsv('manual_adjustment_report.csv', exportData);
  };

  const filteredData = data.filter(item =>
    item.items.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.items.sku && item.items.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const getVarianceColor = (val: number) => {
    if (val > 0) return 'text-green-600';
    if (val < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div>
      {/* Filters Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
        
        {/* Date Range Filter */}
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 text-gray-900 shadow-sm"
            />
          </div>
          <div className="hidden sm:flex items-end pb-3 text-gray-400">
            <ArrowRight size={16} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 text-gray-900 shadow-sm"
            />
          </div>
        </div>

        {/* Search & Export */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search item..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 text-gray-900 shadow-sm"
            />
          </div>
          <Button onClick={handleExport} variant="secondary" className="flex items-center whitespace-nowrap bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm">
            <Download size={16} className="mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <Table
          headers={['Date', 'Item / SKU', 'Adjustment', 'Reason', 'User']}
          loading={loading}
          emptyStateMessage="No manual adjustment history found."
        >
          {currentItems.map((item) => (
            <tr key={item.id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="text-gray-900 font-medium">{new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                  <span className="text-xs text-gray-500 ml-2 bg-gray-100 px-1.5 py-0.5 rounded">
                    {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="font-semibold text-gray-900">{item.items.name}</div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{item.items.sku || '-'}</div>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold ${item.quantity_change > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {item.quantity_change > 0 ? '+' : ''}{item.quantity_change} <span className="ml-1 text-xs font-normal opacity-70">{item.items.unit}</span>
                </span>
              </td>
              <td className="px-6 py-4 text-gray-600 italic max-w-xs truncate">
                "{item.note}"
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center text-gray-600">
                  <User className="w-3 h-3 mr-2 text-gray-400" />
                  {item.users?.full_name || 'System'}
                </div>
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
        ) : currentItems.length > 0 ? (
          currentItems.map((item) => (
            <Card key={item.id} className="p-4 border-l-4 border-l-navbar-accent-1 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-gray-900">{item.items.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{item.items.sku || 'No SKU'}</p>
                </div>
                <span className={`text-sm font-bold ${getVarianceColor(item.quantity_change)}`}>
                  {item.quantity_change > 0 ? '+' : ''}{item.quantity_change} {item.items.unit}
                </span>
              </div>
              
              <div className="text-xs text-gray-500 mb-3 flex items-center">
                 <Calendar className="w-3 h-3 mr-1" />
                 {new Date(item.created_at).toLocaleDateString('id-ID')} • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>

              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 italic mb-3 border border-gray-100">
                "{item.note}"
              </div>

              <div className="text-xs text-gray-400 flex items-center justify-end border-t border-gray-100 pt-2">
                <User className="w-3 h-3 mr-1" /> {item.users?.full_name || 'System'}
              </div>
            </Card>
          ))
        ) : (
          <Card className="text-center p-12 text-gray-500 border border-dashed border-gray-300 bg-gray-50">
            No data found matching your filters.
          </Card>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && filteredData.length > 0 && (
        <div className="flex items-center justify-between mt-6 px-2">
          <div className="text-sm text-gray-600">
            Page <span className="font-semibold text-gray-900">{currentPage}</span> of <span className="font-semibold text-gray-900">{totalPages}</span>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="secondary" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
            >
              Previous
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualAdjustmentReport;
