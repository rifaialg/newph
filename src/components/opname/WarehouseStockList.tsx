import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import Card from '../ui/Card';
import { Package, Search, RefreshCw, Edit2, AlertCircle, CheckCircle, AlertTriangle, Plus, Minus, Trash2, RotateCcw } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';

interface WarehouseItem {
  id: number;
  name: string;
  unit: string;
  cost_price: number;
  current_stock: number;
  min_stock: number;
  category_name?: string;
}

const WarehouseStockList: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit Stock State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'reduce'>('add');
  const [adjustmentQty, setAdjustmentQty] = useState<number | ''>('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Single Item State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<WarehouseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- NEW: Reset All State ---
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchStock = async () => {
    setLoading(true);
    try {
      // Fetch items that are categorized as 'Bahan Baku'
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select(`
          id, name, unit, cost_price, min_stock,
          item_categories!inner(name)
        `)
        .eq('is_active', true)
        .ilike('item_categories.name', '%Bahan Baku%') // Filter by category name
        .order('name');

      if (itemsError) throw itemsError;

      // Calculate stock for each item
      const stockPromises = itemsData.map(async (item: any) => {
        const { data: stockData } = await supabase.rpc('get_item_stock', { p_item_id: item.id });
        return {
          id: item.id,
          name: item.name,
          unit: item.unit,
          cost_price: item.cost_price,
          min_stock: item.min_stock || 10, // Default min stock if null
          category_name: item.item_categories?.name,
          current_stock: stockData || 0
        };
      });

      const results = await Promise.all(stockPromises);
      setItems(results);

    } catch (error: any) {
      console.error("Error fetching warehouse stock:", error);
      toast.error("Gagal memuat stok gudang.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const handleEditClick = (item: WarehouseItem) => {
    setSelectedItem(item);
    setAdjustmentType('add');
    setAdjustmentQty('');
    setAdjustmentReason('');
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (item: WarehouseItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      toast.success(`Bahan baku "${itemToDelete.name}" berhasil dihapus.`);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchStock(); // Refresh data
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(`Gagal menghapus: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- NEW: Handle Reset All Logic ---
  const handleResetAllData = async () => {
    setIsResetting(true);
    try {
      // 1. Dapatkan semua ID item yang termasuk 'Bahan Baku'
      // Kita menggunakan query yang sama dengan fetchStock untuk memastikan targetnya tepat
      const { data: itemsToDelete, error: fetchError } = await supabase
        .from('items')
        .select('id')
        .ilike('item_categories.name', '%Bahan Baku%');

      if (fetchError) throw fetchError;

      if (!itemsToDelete || itemsToDelete.length === 0) {
        toast.info("Gudang sudah kosong. Tidak ada data yang perlu di-reset.");
        setIsResetModalOpen(false);
        setIsResetting(false);
        return;
      }

      const ids = itemsToDelete.map(i => i.id);

      // 2. Hapus Items
      // Note: Karena database memiliki ON DELETE CASCADE pada stock_movements,
      // menghapus items akan OTOMATIS menghapus riwayat transaksi (purchase history).
      // Penghapusan riwayat transaksi inilah yang menyebabkan Counter Invoice di IncomingStockPage
      // kembali ke 001 (karena tidak ada transaksi hari ini yang ditemukan).
      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;

      toast.success("Gudang berhasil di-reset! Counter Invoice telah kembali ke awal.");
      setIsResetModalOpen(false);
      fetchStock(); // Refresh tampilan (seharusnya kosong)

    } catch (error: any) {
      console.error("Reset error:", error);
      toast.error(`Gagal melakukan reset: ${error.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!selectedItem || !adjustmentQty || adjustmentQty <= 0 || !adjustmentReason) {
      toast.error("Mohon lengkapi data penyesuaian.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: locations } = await supabase.from('locations').select('id').limit(1);
      const fallbackLocationId = locations?.[0]?.id;

      if (!fallbackLocationId) throw new Error("Lokasi default tidak ditemukan.");

      const qtyChange = adjustmentType === 'add' ? Number(adjustmentQty) : -Number(adjustmentQty);
      
      // Prevent negative stock if reducing
      if (adjustmentType === 'reduce' && (selectedItem.current_stock + qtyChange < 0)) {
        throw new Error("Stok tidak mencukupi untuk pengurangan ini.");
      }

      const { error } = await supabase.from('stock_movements').insert({
        item_id: selectedItem.id,
        location_id: fallbackLocationId,
        quantity_change: qtyChange,
        movement_type: 'manual_adjustment',
        note: `Manual Stock Edit: ${adjustmentReason}`,
        created_by: user?.id
      });

      if (error) throw error;

      toast.success(`Stok ${selectedItem.name} berhasil diperbarui.`);
      setIsEditModalOpen(false);
      fetchStock(); // Refresh data

    } catch (error: any) {
      toast.error(`Gagal update stok: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStockStatus = (current: number, min: number) => {
    if (current <= 0) return { label: 'Habis', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
    if (current <= min) return { label: 'Menipis', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertTriangle };
    return { label: 'Aman', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle };
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mt-10 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <Package className="w-6 h-6 mr-2 text-blue-600" />
          Stok Gudang (Bahan Baku)
        </h2>
        
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari bahan baku..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          
          <button 
            onClick={fetchStock}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={18} />
          </button>

          {/* Reset Button */}
          <button 
            onClick={() => setIsResetModalOpen(true)}
            className="flex items-center px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors text-sm font-medium"
            title="Reset Semua Data Gudang"
          >
            <RotateCcw size={16} className="mr-1.5" />
            Reset Gudang
          </button>
        </div>
      </div>

      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Nama Bahan</th>
              <th className="px-6 py-4">Kategori</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Stok</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
               [...Array(3)].map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td></tr>
               ))
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const status = getStockStatus(item.current_stock, item.min_stock);
                const StatusIcon = status.icon;
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-gray-500">{item.category_name || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-gray-900">{item.current_stock}</span> <span className="text-xs text-gray-500">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                          onClick={() => handleEditClick(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit Stok"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(item)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Hapus Bahan Baku"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Tidak ada data bahan baku.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const status = getStockStatus(item.current_stock, item.min_stock);
            return (
              <Card key={item.id} className="p-4 border-l-4 border-blue-500">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                    <span className="text-xs text-gray-500">{item.category_name}</span>
                  </div>
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => handleEditClick(item)}
                      className="p-2 text-blue-600 bg-blue-50 rounded-full"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(item)}
                      className="p-2 text-red-500 bg-red-50 rounded-full"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${status.color}`}>
                    {status.label}
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-gray-500 uppercase mr-2">Stok Saat Ini</span>
                    <span className="font-bold text-lg text-gray-900">{item.current_stock} <span className="text-sm font-normal text-gray-500">{item.unit}</span></span>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
            Tidak ada data bahan baku.
          </div>
        )}
      </div>

      {/* Edit Stock Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Stok: ${selectedItem?.name}`}
      >
        {/* ... (Existing Edit Modal Content) ... */}
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center">
            <span className="text-sm text-blue-700 font-medium">Stok Saat Ini</span>
            <span className="text-lg font-bold text-blue-900">{selectedItem?.current_stock} {selectedItem?.unit}</span>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Penyesuaian</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAdjustmentType('add')}
                className={`flex items-center justify-center py-2 rounded-lg border transition-all ${
                  adjustmentType === 'add' 
                    ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Plus size={16} className="mr-2" /> Tambah Stok
              </button>
              <button
                onClick={() => setAdjustmentType('reduce')}
                className={`flex items-center justify-center py-2 rounded-lg border transition-all ${
                  adjustmentType === 'reduce' 
                    ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Minus size={16} className="mr-2" /> Kurangi Stok
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jumlah {adjustmentType === 'add' ? 'Masuk' : 'Keluar'}</label>
            <input
              type="number"
              min="1"
              value={adjustmentQty}
              onChange={(e) => setAdjustmentQty(parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alasan / Catatan</label>
            <select
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm bg-white"
            >
              <option value="">-- Pilih Alasan Umum --</option>
              {adjustmentType === 'add' ? (
                <>
                  <option value="Barang Masuk (Supplier)">Barang Masuk (Supplier)</option>
                  <option value="Retur Outlet">Retur dari Outlet</option>
                  <option value="Koreksi Opname">Koreksi Opname (+)</option>
                </>
              ) : (
                <>
                  <option value="Produksi">Pemakaian Produksi</option>
                  <option value="Rusak / Basi">Barang Rusak / Basi</option>
                  <option value="Koreksi Opname">Koreksi Opname (-)</option>
                </>
              )}
            </select>
            <input
              type="text"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
              placeholder="Atau ketik alasan manual..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button 
              variant="secondary" 
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSaveAdjustment}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-lg shadow-blue-200"
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Simpan Perubahan'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Single Item Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus Bahan Baku"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-800">Konfirmasi Penghapusan</h4>
              <p className="text-sm text-red-700 mt-1">
                Anda akan menghapus <strong>"{itemToDelete?.name}"</strong>.
              </p>
              <p className="text-xs text-red-600 mt-2">
                Tindakan ini akan menghapus item ini dari database beserta riwayat stoknya secara permanen.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
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
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-200"
            >
              {isDeleting ? <Spinner size="sm" /> : 'Hapus Permanen'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* RESET ALL MODAL (NEW) */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Reset Total Data Gudang"
      >
        <div className="space-y-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col items-center text-center">
            <div className="p-3 bg-red-100 rounded-full mb-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h4 className="font-bold text-red-900 text-lg">Tindakan Destruktif!</h4>
            <p className="text-sm text-red-700 mt-2">
              Anda akan menghapus <strong>SEMUA</strong> data Bahan Baku dan Riwayat Transaksi Pembelian.
            </p>
          </div>
          
          <div className="text-sm text-gray-600 space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="font-semibold text-gray-800">Konsekuensi tindakan ini:</p>
            <ul className="list-disc list-inside pl-1 space-y-1">
                <li>Semua item di daftar "Stok Gudang" akan dihapus.</li>
                <li>Semua riwayat "Barang Masuk" akan dihapus.</li>
                <li className="font-bold text-red-600">Penghitung No. Invoice Otomatis akan di-reset ke 001.</li>
                <li>Data "Produk Jadi" (Master) TIDAK akan terhapus.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button 
              variant="secondary" 
              onClick={() => setIsResetModalOpen(false)}
              disabled={isResetting}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={handleResetAllData}
              disabled={isResetting}
              className="bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-200 w-full sm:w-auto"
            >
              {isResetting ? <Spinner size="sm" /> : 'Ya, Hapus & Reset Semua'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default WarehouseStockList;
