import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { 
  Search, Download, Filter, Calendar, Store, 
  ChevronLeft, ChevronRight, ArrowUpRight, ShoppingBag, DollarSign, Trash2, AlertTriangle 
} from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { exportToCsv } from '../../utils/export';
import { Order, OrderMetrics } from '../../types/report';

const OutletOrderReport: React.FC = () => {
  // Data State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [outletsList, setOutletsList] = useState<string[]>([]);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Data Fetching & Processing ---
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          created_at,
          quantity_change,
          note,
          items (name, cost_price),
          users (full_name)
        `)
        .eq('movement_type', 'distribution')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const groupedOrders: Record<string, Order> = {};

      data?.forEach((move: any) => {
        const note = move.note || '';
        const orderIdMatch = note.match(/ORDER-\d+-\d+/);
        const orderId = orderIdMatch ? orderIdMatch[0] : `ORD-${new Date(move.created_at).getTime()}`;
        
        const outletMatch = note.match(/for (.+?)\./); 
        const outletName = outletMatch ? outletMatch[1] : 'Unknown Outlet';

        const itemTotal = Math.abs(move.quantity_change) * (move.items?.cost_price || 0);

        if (!groupedOrders[orderId]) {
          groupedOrders[orderId] = {
            id: orderId,
            date: move.created_at,
            outlet_name: outletName,
            pic_name: move.users?.full_name || 'System',
            total_items: 0,
            total_amount: 0,
            status: 'completed',
            items: []
          };
        }

        groupedOrders[orderId].total_items += Math.abs(move.quantity_change);
        groupedOrders[orderId].total_amount += itemTotal;
        groupedOrders[orderId].items.push(move.items?.name);
      });

      const processedOrders = Object.values(groupedOrders).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setOrders(processedOrders);
      
      const uniqueOutlets = Array.from(new Set(processedOrders.map(o => o.outlet_name))).sort();
      setOutletsList(uniqueOutlets);

    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memuat data pesanan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // --- Deletion Logic ---
  const handleDeleteHistory = async () => {
    setIsDeleting(true);
    try {
      // Menghapus semua stock movements tipe distribusi yang memiliki note 'Duitku'
      // Ini akan menghapus record transaksi dan mengembalikan stok secara logis (karena record pengurangan dihapus)
      const { error } = await supabase
        .from('stock_movements')
        .delete()
        .eq('movement_type', 'distribution')
        .ilike('note', '%Duitku%');

      if (error) throw error;

      toast.success("Semua riwayat pembayaran Duitku berhasil dihapus.");
      setIsDeleteModalOpen(false);
      fetchOrders(); // Refresh data
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(`Gagal menghapus riwayat: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Filtering Logic ---
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.pic_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesOutlet = selectedOutlet === 'all' || order.outlet_name === selectedOutlet;
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      let matchesDate = true;
      if (startDate) matchesDate = matchesDate && new Date(order.date) >= new Date(startDate);
      if (endDate) matchesDate = matchesDate && new Date(order.date) <= new Date(endDate + 'T23:59:59');

      return matchesSearch && matchesOutlet && matchesStatus && matchesDate;
    });
  }, [orders, searchQuery, selectedOutlet, statusFilter, startDate, endDate]);

  // --- Metrics Calculation ---
  const metrics: OrderMetrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalOrders = filteredOrders.length;
    const averageValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalRevenue, totalOrders, averageValue };
  }, [filteredOrders]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- Export ---
  const handleExport = () => {
    const csvData = filteredOrders.map(o => ({
      'Order ID': o.id,
      'Date': new Date(o.date).toLocaleDateString('id-ID'),
      'Outlet': o.outlet_name,
      'PIC': o.pic_name,
      'Items Count': o.total_items,
      'Total Amount': o.total_amount,
      'Status': o.status
    }));
    exportToCsv('outlet_orders_report.csv', csvData);
  };

  // --- Helper: Status Badge ---
  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.completed} capitalize`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* --- Summary Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border-l-4 border-l-navbar-accent-1 bg-gradient-to-br from-white to-orange-50/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Pendapatan</p>
              {loading ? <Skeleton className="h-8 w-32 mt-1" /> : (
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  Rp {metrics.totalRevenue.toLocaleString('id-ID')}
                </h3>
              )}
            </div>
            <div className="p-3 bg-orange-100 rounded-xl text-navbar-accent-1">
              <DollarSign size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Pesanan</p>
              {loading ? <Skeleton className="h-8 w-20 mt-1" /> : (
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics.totalOrders}
                </h3>
              )}
            </div>
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
              <ShoppingBag size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Rata-rata Transaksi</p>
              {loading ? <Skeleton className="h-8 w-32 mt-1" /> : (
                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                  Rp {metrics.averageValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </h3>
              )}
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
              <ArrowUpRight size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* --- Filters & Actions --- */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          
          {/* Search */}
          <div className="relative flex-grow lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari ID Pesanan atau Nama PIC..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 outline-none"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navbar-accent-1/20 outline-none"
              />
            </div>
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navbar-accent-1/20 outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="secondary" className="flex items-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700">
              <Download size={16} className="mr-2" /> Export
            </Button>
            <Button 
              onClick={() => setIsDeleteModalOpen(true)} 
              className="flex items-center bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300"
            >
              <Trash2 size={16} className="mr-2" /> Hapus Riwayat
            </Button>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[180px]">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-navbar-accent-1/20 outline-none cursor-pointer"
            >
              <option value="all">Semua Outlet</option>
              {outletsList.map(outlet => (
                <option key={outlet} value={outlet}>{outlet}</option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[150px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-navbar-accent-1/20 outline-none cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="completed">Selesai</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- Data Table --- */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">ID Pesanan</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Outlet</th>
                <th className="px-6 py-4">PIC</th>
                <th className="px-6 py-4 text-right">Total Harga</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4"><Skeleton className="h-6 w-full" /></td>
                  </tr>
                ))
              ) : paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500 group-hover:text-navbar-accent-1 transition-colors">
                      {order.id}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      <span className="block text-xs text-gray-400 mt-0.5">
                        {new Date(order.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{order.outlet_name}</td>
                    <td className="px-6 py-4 text-gray-600">{order.pic_name}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      Rp {order.total_amount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="bg-gray-100 p-3 rounded-full mb-3">
                        <Search className="w-6 h-6 text-gray-400" />
                      </div>
                      <p>Tidak ada pesanan yang ditemukan.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && filteredOrders.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Menampilkan <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-semibold">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> dari <span className="font-semibold">{filteredOrders.length}</span> data
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Konfirmasi Hapus Riwayat"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-800">Peringatan Penting!</h4>
              <p className="text-sm text-red-700 mt-1">
                Tindakan ini akan menghapus <strong>SEMUA</strong> riwayat transaksi pembayaran Duitku dari sistem.
                Data yang dihapus tidak dapat dikembalikan. Stok barang akan dikembalikan (reverted) secara logis karena riwayat pengeluarannya dihapus.
              </p>
            </div>
          </div>
          
          <p className="text-gray-600">
            Apakah Anda yakin ingin melanjutkan penghapusan data ini?
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={handleDeleteHistory}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-200"
            >
              {isDeleting ? <Spinner size="sm" /> : 'Ya, Hapus Semua'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OutletOrderReport;
