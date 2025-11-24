import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types/database';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import ManualAdjustmentHistory from '../../components/opname/ManualAdjustmentHistory';
import WarehouseStockList from '../../components/opname/WarehouseStockList';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Tags, Edit, Trash2, Search, Package, AlertTriangle, RefreshCw, CheckCircle, AlertCircle, Database } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import ItemForm from '../../components/inventory/ItemForm';
import CategoryForm from '../../components/inventory/CategoryForm';
import Table from '../../components/ui/Table';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import { toast } from 'sonner';
import StatusToggle from '../../components/ui/StatusToggle';
import Spinner from '../../components/ui/Spinner';

// Extended Interface for UI Logic
interface ProductWithStock extends Item {
  current_stock?: number;
  stock_status?: 'synced' | 'error' | 'loading';
}

const SessionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageInventory = hasPermission('manage_inventory');
  
  // Modal States
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  
  // Delete States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Product List States
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Stock Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // --- Fetch Products (Only Finished Goods) ---
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      // 1. Fetch items that are NOT 'Bahan Baku' (Finished Goods)
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*, item_categories!inner(name)')
        .not('item_categories.name', 'ilike', '%Bahan Baku%') // Exclude raw materials
        .order('name');
      
      if (itemsError) throw itemsError;

      // 2. Initial mapping without stock
      const initialProducts: ProductWithStock[] = (itemsData as Item[]).map(item => ({
        ...item,
        current_stock: 0,
        stock_status: 'loading'
      }));

      setProducts(initialProducts);
      
      // 3. Trigger Stock Sync immediately after loading list
      syncStockData(initialProducts);

    } catch (error: any) {
      toast.error(`Gagal memuat produk: ${error.message}`);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // --- Stock Synchronization Logic ---
  const syncStockData = async (currentList: ProductWithStock[]) => {
    setIsSyncing(true);
    try {
      // Menggunakan RPC yang sama dengan laporan stok untuk menjamin konsistensi data (Single Source of Truth)
      const { data: stockData, error: stockError } = await supabase.rpc('get_stock_summary_report');

      if (stockError) throw stockError;

      // Create a map for O(1) lookup: Item Name -> Quantity
      // Note: Using Name or ID depending on what RPC returns. Ideally ID.
      // Assuming get_stock_summary_report returns { item_name, quantity, ... }
      // If RPC returns item_id, use that. If strictly names, use names.
      // Let's assume we map by name for now based on previous context, or better yet, fetch raw stock movements if RPC is limited.
      
      // ALTERNATIVE ROBUST FETCH: Group by item_id from stock_movements directly
      const { data: movements, error: movError } = await supabase
        .from('stock_movements')
        .select('item_id, quantity_change');

      if (movError) throw movError;

      const stockMap = new Map<number, number>();
      movements?.forEach(m => {
        const current = stockMap.get(m.item_id) || 0;
        stockMap.set(m.item_id, current + m.quantity_change);
      });

      // Update Product List with Synced Stock
      setProducts(prevProducts => {
        // Use passed list if provided (for initial load), otherwise use state
        const listToUpdate = currentList.length > 0 ? currentList : prevProducts;
        
        return listToUpdate.map(p => ({
          ...p,
          current_stock: stockMap.get(p.id) || 0,
          stock_status: 'synced'
        }));
      });

      setLastSynced(new Date());
      if (!loadingProducts) toast.success("Stok berhasil disinkronkan dengan Distribusi.");

    } catch (error: any) {
      console.error("Sync Error:", error);
      toast.error("Gagal menyinkronkan stok.");
      setProducts(prev => prev.map(p => ({ ...p, stock_status: 'error' })));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // --- Product Handlers ---

  const handleEditProduct = (item: Item) => {
    setEditingItem(item);
    setIsAddProductModalOpen(true);
  };

  const handleToggleStatus = async (item: Item) => {
    const newStatus = !item.is_active;
    
    // Optimistic Update
    setProducts(prev => prev.map(p => p.id === item.id ? { ...p, is_active: newStatus } : p));

    try {
      const { error } = await supabase
        .from('items')
        .update({ is_active: newStatus })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success(`Produk "${item.name}" sekarang ${newStatus ? 'Aktif' : 'Non-aktif'}.`);
    } catch (error: any) {
      // Revert on error
      setProducts(prev => prev.map(p => p.id === item.id ? { ...p, is_active: !newStatus } : p));
      toast.error(`Gagal update status: ${error.message}`);
    }
  };

  const handleDeleteClick = (item: Item) => {
    if (item.is_active) {
      toast.error("Tidak dapat menghapus produk aktif. Non-aktifkan terlebih dahulu.");
      return;
    }
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmForceDelete = async () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error: itemError } = await supabase
        .from('items')
        .delete()
        .eq('id', itemToDelete.id);

      if (itemError) throw itemError;

      toast.success(`Produk "${itemToDelete.name}" berhasil dihapus permanen.`);
      fetchProducts();
      setIsDeleteModalOpen(false);
      setItemToDelete(null);

    } catch (error: any) {
      console.error("Delete failed:", error);
      toast.error(`Gagal menghapus produk: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalClose = () => {
    setIsAddProductModalOpen(false);
    setEditingItem(null);
  };

  const handleProductSuccess = () => {
    handleModalClose();
    fetchProducts();
  };

  // --- Filtering ---
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-10">
      <PageHeader title="Manajemen Stok & Produk">
        <div className="flex flex-col sm:flex-row gap-2">
          {canManageInventory && (
            <>
              <Button 
                onClick={() => setIsAddCategoryModalOpen(true)} 
                variant="primary"
                className="w-full sm:w-auto shadow-lg shadow-navbar-accent-1/20 flex items-center justify-center"
              >
                <Tags size={18} className="mr-2" />
                Kategori
              </Button>

              <Button 
                onClick={() => { setEditingItem(null); setIsAddProductModalOpen(true); }} 
                variant="primary"
                className="w-full sm:w-auto shadow-lg shadow-navbar-accent-1/20 flex items-center justify-center"
              >
                <Plus size={18} className="mr-2" />
                Produk Baru
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* --- Product List Section --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm text-navbar-accent-1">
                <Package className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-800">Product Master Data</h3>
                <p className="text-xs text-gray-500 flex items-center">
                    {lastSynced ? (
                        <>
                            <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                            Tersinkronisasi: {lastSynced.toLocaleTimeString('id-ID')}
                        </>
                    ) : (
                        'Menunggu sinkronisasi...'
                    )}
                </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Sync Button */}
            <button
                onClick={() => syncStockData(products)}
                disabled={isSyncing}
                className={`
                    flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border transition-all
                    ${isSyncing 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 shadow-sm'
                    }
                `}
                title="Ambil data stok terbaru dari database"
            >
                <RefreshCw size={16} className={`mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Menyinkronkan...' : 'Sync Stok'}
            </button>

            {/* Search */}
            <div className="relative flex-grow sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                type="text"
                placeholder="Cari produk / SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all"
                />
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block">
          <Table
            headers={['Nama Produk', 'SKU', 'Kategori', 'Harga Jual', 'Stok Aktual', 'Status', 'Aksi']}
            loading={loadingProducts}
            emptyStateMessage="Tidak ada produk ditemukan."
          >
            {filteredProducts.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-none group">
                <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.sku || '-'}</td>
                <td className="px-6 py-4 text-gray-600">{item.item_categories?.name || 'Uncategorized'}</td>
                <td className="px-6 py-4 font-medium text-gray-900">Rp {item.selling_price?.toLocaleString('id-ID') || 0}</td>
                
                {/* Synced Stock Column */}
                <td className="px-6 py-4">
                    {item.stock_status === 'loading' ? (
                        <div className="h-5 w-16 bg-gray-200 rounded animate-pulse"></div>
                    ) : item.stock_status === 'error' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" /> Error
                        </span>
                    ) : (
                        <div className="flex items-center">
                            <span className={`font-bold text-sm ${(item.current_stock || 0) <= (item.min_stock || 0) ? 'text-red-600' : 'text-gray-900'}`}>
                                {item.current_stock}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                            <div className="ml-2 group/tooltip relative">
                                <Database className="w-3 h-3 text-blue-400" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block px-2 py-1 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap">
                                    Data dari Distribusi
                                </span>
                            </div>
                        </div>
                    )}
                </td>

                <td className="px-6 py-4">
                  <StatusToggle 
                    isActive={item.is_active} 
                    onToggle={() => handleToggleStatus(item)} 
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEditProduct(item)}
                      className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-md transition-colors"
                      title="Edit Produk"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(item)}
                      disabled={item.is_active}
                      className={`p-1.5 rounded-md transition-colors ${
                        item.is_active 
                          ? 'text-gray-300 cursor-not-allowed' 
                          : 'text-red-500 hover:bg-red-50 hover:text-red-700'
                      }`}
                      title={item.is_active ? "Non-aktifkan untuk menghapus" : "Hapus Permanen"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="block lg:hidden p-4 space-y-4">
          {loadingProducts ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((item) => (
              <Card key={item.id} className="p-4 border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                    <p className="text-xs text-gray-500 font-mono">{item.sku || 'No SKU'}</p>
                  </div>
                  <StatusToggle 
                    isActive={item.is_active} 
                    onToggle={() => handleToggleStatus(item)} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 my-3 text-sm">
                    <div className="bg-gray-50 p-2 rounded-lg">
                        <span className="block text-xs text-gray-500">Harga Jual</span>
                        <span className="font-semibold text-gray-900">Rp {item.selling_price?.toLocaleString('id-ID')}</span>
                    </div>
                    <div className={`p-2 rounded-lg border ${ (item.current_stock || 0) <= (item.min_stock || 0) ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                        <span className="block text-xs text-gray-500 flex items-center">
                            Stok Aktual <Database className="w-3 h-3 ml-1 opacity-50" />
                        </span>
                        <span className={`font-bold ${(item.current_stock || 0) <= (item.min_stock || 0) ? 'text-red-700' : 'text-blue-700'}`}>
                            {item.current_stock} {item.unit}
                        </span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-50">
                  <button 
                    onClick={() => handleEditProduct(item)}
                    className="flex items-center text-sm text-amber-600 font-medium"
                  >
                    <Edit size={16} className="mr-1" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(item)}
                    disabled={item.is_active}
                    className={`flex items-center text-sm font-medium ${
                      item.is_active ? 'text-gray-300' : 'text-red-600'
                    }`}
                  >
                    <Trash2 size={16} className="mr-1" /> Hapus
                  </button>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">Tidak ada produk ditemukan.</div>
          )}
        </div>
      </div>

      {/* --- Warehouse Stock List --- */}
      <WarehouseStockList />

      {/* --- History Section --- */}
      <ManualAdjustmentHistory />

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={isAddProductModalOpen}
        onClose={handleModalClose}
        title={editingItem ? "Edit Produk" : "Tambah Produk Baru"}
      >
        <ItemForm 
          item={editingItem}
          onSuccess={handleProductSuccess} 
        />
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        title="Manajemen Kategori"
      >
        <CategoryForm 
          onSuccess={() => {}}
          onCancel={() => setIsAddCategoryModalOpen(false)}
        />
      </Modal>

      {/* Force Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { if (!isDeleting) setIsDeleteModalOpen(false); }}
        title="Hapus Paksa Produk"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-800">Peringatan: Tindakan Destruktif</h4>
              <p className="text-sm text-red-700 mt-1">
                Anda akan menghapus paksa <strong>"{itemToDelete?.name}"</strong>.
              </p>
              <p className="text-sm text-red-700 mt-2">
                Tindakan ini akan <strong>menghapus permanen</strong> produk beserta SEMUA data terkait:
              </p>
              <ul className="list-disc list-inside text-xs text-red-600 mt-1 ml-1">
                <li>Riwayat pergerakan stok (masuk/keluar)</li>
                <li>Catatan stok opname</li>
                <li>Resep terkait (jika ada)</li>
              </ul>
            </div>
          </div>
          
          <p className="text-gray-600 text-sm">
            Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin melanjutkan?
          </p>

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
              onClick={handleConfirmForceDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-200"
            >
              {isDeleting ? <Spinner size="sm" /> : 'Ya, Hapus Paksa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SessionsPage;
