import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import Modal from '../ui/Modal';
import { 
  TrendingUp, TrendingDown, Wallet, Calendar, Download, 
  Sparkles, Plus, Search, Filter, ArrowUpRight, ArrowDownRight,
  FileText, CreditCard, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Clock, Hash
} from 'lucide-react';
import { exportToCsv } from '../../utils/export';

// --- 1. DEFINISI TIPE DATA (INTERFACES) ---

type TimeRange = 'this_month' | 'last_month' | 'lifetime';
type TransactionType = 'income' | 'expense';

// Interface untuk data mentah dari Database (Join query result)
interface RawMovement {
  id: number;
  created_at: string;
  quantity_change: number;
  movement_type: string;
  note: string | null;
  items: {
    name: string;
    unit: string;
    cost_price: number;
    selling_price: number;
  } | null;
  users: {
    full_name: string;
  } | null;
}

// Interface untuk Data Transaksi yang sudah diproses (Sesuai Request)
interface ProcessedTransaction {
  id: string;
  date: string;
  type: TransactionType;
  
  // Properti Logika Bisnis
  source: 'Barang Masuk' | 'Distribusi' | 'Lainnya';
  storage_destination?: 'Stok Gudang' | 'Product Master';
  destination_outlet?: string;
  
  // Properti Item
  item_name: string;
  quantity: number;
  unit: string;
  amount: number; // Nominal Rupiah
  
  // Properti Hasil Formating
  category_label: string; // Hasil logika kategori
  description_text: string; // Hasil template literal
  
  payment_method: string;
  dispatcher_note: string;
}

const AnalyticsDashboard: React.FC = () => {
  // --- State ---
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
  const [tableFilter, setTableFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Mobile Accordion State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Modal State (Manual Input)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTrxType, setNewTrxType] = useState<TransactionType>('expense');
  const [newTrxAmount, setNewTrxAmount] = useState('');
  const [newTrxDesc, setNewTrxDesc] = useState('');
  const [newTrxCategory, setNewTrxCategory] = useState('');
  const [newTrxDate, setNewTrxDate] = useState(new Date().toISOString().split('T')[0]);

  // --- 2. LOGIKA PEMROSESAN DATA (BUSINESS LOGIC) ---

  const formatTransactionData = (move: RawMovement): ProcessedTransaction => {
    const note = move.note || '';
    const qty = Math.abs(move.quantity_change);
    const itemName = move.items?.name || 'Unknown Item';
    const unit = move.items?.unit || 'pcs';
    
    // Ekstraksi Data dari Notes menggunakan Regex
    const paymentMatch = note.match(/Payment:\s*([A-Za-z]+)/i);
    const paymentMethod = paymentMatch ? paymentMatch[1].toUpperCase() : 'CASH'; 

    const dispatcherName = move.users?.full_name || 'Sistem';
    
    let type: TransactionType = 'expense';
    let source: 'Barang Masuk' | 'Distribusi' | 'Lainnya' = 'Lainnya';
    let categoryLabel = 'Umum';
    let descriptionText = note;
    let amount = 0;

    // KONDISI 1: BARANG MASUK (Purchase) -> Pengeluaran
    if (move.movement_type === 'purchase') {
      type = 'expense';
      source = 'Barang Masuk';
      
      const isWarehouse = note.includes('[GUDANG]');
      const isProductMaster = note.includes('[PRODUK JADI]');
      
      if (isWarehouse) {
        categoryLabel = 'Stok Bahan Baku';
      } else if (isProductMaster) {
        categoryLabel = 'Stok Barang Jadi';
      } else {
        categoryLabel = 'Stok Bahan Baku'; 
      }

      amount = qty * (move.items?.cost_price || 0);
      descriptionText = `Stok masuk ${itemName} sebanyak ${qty} ${unit} dibayar ${paymentMethod}`;
    } 
    
    // KONDISI 2: DISTRIBUSI (Distribution) -> Pemasukan
    else if (move.movement_type === 'distribution') {
      type = 'income';
      source = 'Distribusi';
      
      const outletMatch = note.match(/Distribution to:\s*([^.]+)/i) || note.match(/for\s+([^.]+)/i);
      const outletName = outletMatch ? outletMatch[1].trim() : 'Outlet Umum';

      categoryLabel = `Distribusi untuk ${outletName}`;

      const price = move.items?.selling_price || (move.items?.cost_price || 0) * 1.3;
      amount = qty * price;

      descriptionText = `Stok ${itemName} keluar untuk outlet ${outletName} dibayar ${paymentMethod} diantar oleh ${dispatcherName}`;
    }
    
    // KONDISI 3: LAINNYA
    else {
      type = move.quantity_change > 0 ? 'income' : 'expense';
      categoryLabel = 'Penyesuaian Stok (Opname)';
      amount = qty * (move.items?.cost_price || 0);
      descriptionText = `Penyesuaian stok ${itemName}: ${note}`;
    }

    return {
      id: `TRX-${move.id}`,
      date: move.created_at,
      type,
      source,
      item_name: itemName,
      quantity: qty,
      unit,
      amount,
      category_label: categoryLabel,
      description_text: descriptionText,
      payment_method: paymentMethod,
      dispatcher_note: dispatcherName
    };
  };

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: movements, error } = await supabase
          .from('stock_movements')
          .select(`
            id, created_at, quantity_change, movement_type, note,
            items (name, unit, cost_price, selling_price),
            users (full_name)
          `)
          .in('movement_type', ['purchase', 'distribution', 'manual_adjustment'])
          .order('created_at', { ascending: false });

        if (error) throw error;

        const processedData = (movements as any[]).map(formatTransactionData);
        setTransactions(processedData);

      } catch (err) {
        console.error(err);
        toast.error("Gagal memuat data keuangan.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Filtering Logic ---
  const filteredData = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      let timeMatch = true;
      if (timeRange === 'this_month') {
        timeMatch = tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      } else if (timeRange === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        timeMatch = tDate.getMonth() === lastMonth.getMonth() && tDate.getFullYear() === lastMonth.getFullYear();
      }

      const typeMatch = tableFilter === 'all' || t.type === tableFilter;

      const searchMatch = searchQuery === '' || 
        t.description_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());

      return timeMatch && typeMatch && searchMatch;
    });
  }, [transactions, timeRange, tableFilter, searchQuery]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange, tableFilter, searchQuery]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- Metrics Calculation ---
  const metrics = useMemo(() => {
    const income = filteredData.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredData.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;
    return { income, expense, balance };
  }, [filteredData]);

  // --- Chart Options ---
  const cashflowOption = useMemo(() => {
    const grouped = filteredData.reduce((acc, t) => {
      const date = new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      if (!acc[date]) acc[date] = { income: 0, expense: 0 };
      acc[date][t.type] += t.amount;
      return acc;
    }, {} as Record<string, { income: number, expense: number }>);

    const dates = Object.keys(grouped).reverse();
    
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, icon: 'circle' },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '5%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: dates, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } } },
      series: [
        {
          name: 'Pemasukan',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: dates.map(d => grouped[d].income),
          itemStyle: { color: '#10B981' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16, 185, 129, 0.2)' }, { offset: 1, color: 'rgba(16, 185, 129, 0)' }] } }
        },
        {
          name: 'Pengeluaran',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: dates.map(d => grouped[d].expense),
          itemStyle: { color: '#EF4444' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(239, 68, 68, 0.2)' }, { offset: 1, color: 'rgba(239, 68, 68, 0)' }] } }
        }
      ]
    };
  }, [filteredData]);

  const handleExport = () => {
    const csvData = filteredData.map(t => ({
      ID: t.id,
      Tanggal: new Date(t.date).toLocaleDateString('id-ID'),
      Tipe: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      Kategori: t.category_label,
      Deskripsi: t.description_text,
      Nominal: t.amount,
      Metode: t.payment_method
    }));
    exportToCsv('laporan_keuangan_detail.csv', csvData);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in relative min-h-screen">
      
      {/* --- HEADER & CONTROLS --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan & Arus Kas</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white p-1 rounded-lg border border-gray-200 flex text-xs font-medium shadow-sm overflow-x-auto max-w-full">
            {(['this_month', 'last_month', 'lifetime'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  timeRange === range 
                    ? 'bg-gray-900 text-white shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {range === 'this_month' ? 'Bulan Ini' : range === 'last_month' ? 'Bulan Lalu' : 'Semua'}
              </button>
            ))}
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            CSV
          </button>
        </div>
      </div>

      {/* --- SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Pemasukan</p>
              {loading ? <Skeleton className="h-8 w-32" /> : (
                <h3 className="text-3xl font-bold text-gray-900">
                  Rp {metrics.income.toLocaleString('id-ID')}
                </h3>
              )}
              <div className="flex items-center mt-2 text-xs font-medium text-green-600">
                <TrendingUp className="w-3 h-3 mr-1" />
                <span>Distribusi & Penjualan</span>
              </div>
            </div>
            <div className="p-2 bg-green-500 rounded-full text-white shadow-lg shadow-green-200">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Pengeluaran</p>
              {loading ? <Skeleton className="h-8 w-32" /> : (
                <h3 className="text-3xl font-bold text-gray-900">
                  Rp {metrics.expense.toLocaleString('id-ID')}
                </h3>
              )}
              <div className="flex items-center mt-2 text-xs font-medium text-red-600">
                <TrendingDown className="w-3 h-3 mr-1" />
                <span>Pembelian Stok & Biaya</span>
              </div>
            </div>
            <div className="p-2 bg-red-500 rounded-full text-white shadow-lg shadow-red-200">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Saldo Bersih</p>
              {loading ? <Skeleton className="h-8 w-32" /> : (
                <h3 className={`text-3xl font-bold ${metrics.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  Rp {metrics.balance.toLocaleString('id-ID')}
                </h3>
              )}
              <p className="text-xs text-gray-400 mt-2">Estimasi Profitabilitas</p>
            </div>
            <div className="p-2 bg-blue-500 rounded-full text-white shadow-lg shadow-blue-200">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* --- CHART --- */}
      <Card className="p-6 border border-gray-100">
        <h3 className="text-base font-bold text-gray-900 mb-6">Tren Arus Kas</h3>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ReactECharts option={cashflowOption} style={{ height: '300px' }} />
        )}
      </Card>

      {/* --- TRANSACTION LIST / TABLE --- */}
      <Card className="border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-bold text-gray-900">Riwayat Transaksi Detail</h3>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
             <div className="relative flex-grow sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari transaksi / ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
                />
             </div>
             
             <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                {(['all', 'income', 'expense'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTableFilter(filter)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      tableFilter === filter 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {filter === 'all' ? 'Semua' : filter === 'income' ? 'Masuk' : 'Keluar'}
                  </button>
                ))}
              </div>
          </div>
        </div>

        {/* DESKTOP TABLE VIEW (Hidden on Mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Deskripsi Transaksi</th>
                <th className="px-6 py-4">Metode</th>
                <th className="px-6 py-4 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedData.length > 0 ? (
                paginatedData.map((trx) => (
                  <tr key={trx.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                      <div className="font-medium">{new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div className="text-xs text-gray-400">{new Date(trx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</div>
                      <div className="text-[10px] text-gray-300 font-mono mt-1">{trx.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        trx.category_label.includes('Gudang') || trx.category_label.includes('Bahan Baku') ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        trx.category_label.includes('Distribusi') ? 'bg-purple-50 text-purple-700 border-purple-100' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {trx.category_label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-md">
                      {trx.description_text}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                        <span className="uppercase text-xs font-bold">{trx.payment_method}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${trx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {trx.type === 'income' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Tidak ada transaksi ditemukan untuk periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD VIEW (Visible on Mobile) */}
        <div className="md:hidden bg-gray-50 p-3 space-y-3">
          {paginatedData.length > 0 ? (
            paginatedData.map((trx) => {
              const isExpanded = expandedId === trx.id;
              const isIncome = trx.type === 'income';
              
              return (
                <div 
                  key={trx.id} 
                  onClick={() => toggleExpand(trx.id)}
                  className={`bg-white rounded-xl border shadow-sm transition-all duration-200 overflow-hidden ${isExpanded ? 'border-navbar-accent-1 ring-1 ring-navbar-accent-1/20' : 'border-gray-200'}`}
                >
                  <div className="p-4">
                    {/* Header Row */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm mt-1 line-clamp-1">{trx.category_label}</h4>
                      </div>
                      <div className={`text-sm font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncome ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID', { notation: 'compact' })}
                      </div>
                    </div>

                    {/* Sub Info */}
                    <div className="flex justify-between items-center mt-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isIncome ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                        }`}>
                          {isIncome ? 'Masuk' : 'Keluar'}
                        </span>
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 uppercase">
                          {trx.payment_method}
                        </span>
                      </div>
                      <button className="text-gray-400">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-dashed border-gray-200 text-xs text-gray-600 space-y-2 animate-fade-in">
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-400">ID Transaksi</span>
                          <span className="col-span-2 font-mono text-gray-800">{trx.id}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-400">Waktu</span>
                          <span className="col-span-2">{new Date(trx.date).toLocaleTimeString('id-ID')}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-400">Deskripsi</span>
                          <span className="col-span-2 font-medium text-gray-800">{trx.description_text}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-gray-400">Dispatcher</span>
                          <span className="col-span-2">{trx.dispatcher_note}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed">
              <p className="text-sm">Tidak ada transaksi.</p>
            </div>
          )}
        </div>

        {/* PAGINATION CONTROLS */}
        {filteredData.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-500 text-center sm:text-left">
              Menampilkan <span className="font-bold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> dari <span className="font-bold text-gray-900">{filteredData.length}</span>
            </p>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-navbar-accent-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Simple logic to show first few pages, can be improved for many pages
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 2 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        currentPage === pageNum
                          ? 'bg-navbar-accent-1 text-white shadow-md shadow-navbar-accent-1/20'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-navbar-accent-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Floating Action Button (Manual Add) */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-navbar-accent-1 hover:bg-navbar-accent-2 text-white rounded-full shadow-xl shadow-navbar-accent-1/30 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 z-40"
        title="Catat Transaksi Manual"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* --- MANUAL TRANSACTION MODAL --- */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Catat Transaksi Lainnya"
      >
        <div className="space-y-5">
          {/* Type Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Transaksi</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setNewTrxType('income')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  newTrxType === 'income' 
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Pemasukan Lain
              </button>
              <button
                type="button"
                onClick={() => setNewTrxType('expense')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  newTrxType === 'expense' 
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Pengeluaran Lain
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tanggal</label>
            <input 
              type="date" 
              value={newTrxDate}
              onChange={(e) => setNewTrxDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Kategori</label>
              <select 
                value={newTrxCategory}
                onChange={(e) => setNewTrxCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
              >
                <option value="">Pilih...</option>
                {newTrxType === 'income' ? (
                  <>
                    <option value="Investasi">Investasi</option>
                    <option value="Penjualan Aset">Penjualan Aset</option>
                    <option value="Lainnya">Lainnya</option>
                  </>
                ) : (
                  <>
                    <option value="Gaji Karyawan">Gaji Karyawan</option>
                    <option value="Operasional (Listrik/Air)">Operasional (Listrik/Air)</option>
                    <option value="Sewa Tempat">Sewa Tempat</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Marketing">Marketing</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jumlah (Rp)</label>
              <input 
                type="number" 
                value={newTrxAmount}
                onChange={(e) => setNewTrxAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Deskripsi</label>
            <textarea 
              rows={2}
              value={newTrxDesc}
              onChange={(e) => setNewTrxDesc(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
              placeholder="Keterangan transaksi..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
            >
              Batal
            </button>
            <button 
              onClick={() => {
                  toast.info("Fitur simpan manual akan segera hadir (Database update required).");
                  setIsModalOpen(false);
              }}
              className="px-4 py-2 bg-navbar-accent-1 text-white font-bold rounded-lg hover:bg-navbar-accent-2 shadow-lg shadow-navbar-accent-1/20"
            >
              Simpan
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AnalyticsDashboard;
