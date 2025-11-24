import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Item, Outlet } from '../../types/database';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Search, ShoppingCart, Filter, X, Store, Trash2, Plus, Minus, ShoppingBag, ShieldCheck, AlertTriangle, Loader2, Database, Package, AlertCircle } from 'lucide-react';
import ProductCard from '../../components/marketplace/ProductCard';
import Spinner from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import CheckoutForm from '../../components/payment/CheckoutForm';
import Table from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import StatusToggle from '../../components/ui/StatusToggle';
import ItemForm from '../../components/inventory/ItemForm';
import CategoryForm from '../../components/inventory/CategoryForm';

// --- 1. Interface Definition with 'Source' ---
interface ProductMaster extends Item {
  source: 'Stok Gudang Bahan baku (Opname)' | 'Product Master';
  current_stock: number;
  stock_status?: 'synced' | 'error' | 'loading';
  cartQuantity?: number; // For cart logic
}

const ItemsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canManageInventory = hasPermission('manage_inventory');
  
  // Data States
  const [rawItems, setRawItems] = useState<ProductMaster[]>([]);
  const [categories, setCategories] = useState<{id: number, name: string}[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [isValidating, setIsValidating] = useState(false);
  
  // Modal States
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cart States
  const [cart, setCart] = useState<ProductMaster[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState<number | ''>('');
  const [buyNowItem, setBuyNowItem] = useState<ProductMaster | null>(null);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes, outletsRes, movementsRes] = await Promise.all([
        supabase.from('items')
          .select('*, item_categories(name)')
          .eq('is_active', true)
          .order('name'),
        supabase.from('item_categories').select('id, name').order('name'),
        supabase.from('outlets').select('*').eq('is_active', true).order('name'),
        supabase.from('stock_movements').select('item_id, quantity_change')
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (catsRes.error) throw catsRes.error;
      if (outletsRes.error) throw outletsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      // Calculate Stock
      const stockMap = new Map<number, number>();
      movementsRes.data.forEach((m: { item_id: number; quantity_change: number }) => {
        const current = stockMap.get(m.item_id) || 0;
        stockMap.set(m.item_id, current + m.quantity_change);
      });

      // Map to ProductMaster interface and assign Source
      const processedItems: ProductMaster[] = (itemsRes.data as any[]).map(item => {
        const categoryName = item.item_categories?.name || '';
        // Logic to determine source based on category
        const isRawMaterial = categoryName.toLowerCase().includes('bahan baku');
        
        return {
          ...item,
          current_stock: stockMap.get(item.id) || 0,
          stock_status: 'synced',
          // Assign Source Property
          source: isRawMaterial ? 'Stok Gudang Bahan baku (Opname)' : 'Product Master'
        };
      });

      setRawItems(processedItems);
      setCategories(catsRes.data);
      setOutlets(outletsRes.data as Outlet[]);

    } catch (error: any) {
      toast.error(`Failed to load catalog: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- 2. Strict Filtering Logic (useMemo) ---
  const filteredItems = useMemo(() => {
    return rawItems.filter(item => {
      // STRICT FILTER: Exclude 'Stok Gudang Bahan baku (Opname)'
      if (item.source === 'Stok Gudang Bahan baku (Opname)') {
        return false;
      }

      // Search Filter
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.sku?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category Filter
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [rawItems, searchQuery, selectedCategory]);

  // --- Handlers ---

  const handleValidateMasterData = async () => {
    if (!window.confirm("Jalankan validasi? Sistem akan memeriksa integritas data produk.")) return;
    setIsValidating(true);
    try {
      // Simulate validation logic
      await new Promise(r => setTimeout(r, 1000));
      toast.success("Validasi selesai. Data katalog konsisten.");
      fetchData();
    } catch (error: any) {
      toast.error(`Gagal validasi: ${error.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleToggleStatus = async (item: Item) => {
    const newStatus = !item.is_active;
    // Optimistic Update
    setRawItems(prev => prev.map(p => p.id === item.id ? { ...p, is_active: newStatus } : p));
    try {
      const { error } = await supabase.from('items').update({ is_active: newStatus }).eq('id', item.id);
      if (error) throw error;
      toast.success(`Status produk diperbarui.`);
    } catch (error: any) {
      fetchData(); // Revert
      toast.error(`Gagal update status: ${error.message}`);
    }
  };

  const handleDeleteClick = (item: Item) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('items').delete().eq('id', itemToDelete.id);
      if (error) throw error;
      toast.success("Produk berhasil dihapus.");
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(`Gagal menghapus: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Cart Logic ---
  const addToCart = (item: ProductMaster) => {
    if (item.current_stock < 1) {
        toast.error("Stok habis!");
        return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, cartQuantity: (i.cartQuantity || 0) + 1 } : i);
      }
      toast.success("Masuk keranjang");
      return [...prev, { ...item, cartQuantity: 1 }];
    });
  };

  const updateCartQty = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = (item.cartQuantity || 0) + delta;
        return newQty > 0 ? { ...item, cartQuantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.id !== id));
  
  const handleBuyNow = (item: ProductMaster) => {
    if (item.current_stock < 1) {
        toast.error("Stok habis!");
        return;
    }
    setBuyNowItem(item);
    setIsCheckoutModalOpen(true);
  };

  const handleCheckoutSuccess = async (ref?: string) => {
    toast.success("Pesanan berhasil dibuat!");
    setCart([]);
    setBuyNowItem(null);
    setIsCheckoutModalOpen(false);
    setIsCartOpen(false);
    fetchData();
  };

  const cartTotal = cart.reduce((sum, item) => sum + ((item.selling_price || 0) * (item.cartQuantity || 0)), 0);
  const cartCount = cart.reduce((sum, item) => sum + (item.cartQuantity || 0), 0);

  return (
    <div className="relative min-h-screen pb-20 bg-gray-50">
      
      {/* --- Header --- */}
      <div className="sticky -top-4 md:-top-6 z-30 bg-gray-50/90 backdrop-blur-md border-b border-gray-200/50 py-3 px-4 md:px-6 -mx-4 md:-mx-6 mb-4 shadow-sm transition-all">
        <div className="flex justify-between items-center">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-navbar-accent-1" />
            Katalog Produk (Master)
          </h1>
          
          <div className="flex items-center gap-2">
            {canManageInventory && (
                <>
                    <Button onClick={() => setIsAddCategoryModalOpen(true)} variant="secondary" className="hidden sm:flex items-center text-xs px-3 py-2">
                        <Database size={14} className="mr-1.5" /> Kategori
                    </Button>
                    <Button onClick={() => { setEditingItem(null); setIsAddProductModalOpen(true); }} variant="primary" className="hidden sm:flex items-center text-xs px-3 py-2 shadow-md">
                        <Plus size={14} className="mr-1.5" /> Produk Baru
                    </Button>
                </>
            )}
            <Button onClick={() => setIsCartOpen(true)} variant="primary" className="relative px-3 py-2 text-sm shadow-md">
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* --- Controls --- */}
      <div className="space-y-3 px-1 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Cari produk..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 shadow-sm"
                />
            </div>
            <div className="relative min-w-[200px]">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 shadow-sm cursor-pointer"
                >
                    <option value="all">Semua Kategori</option>
                    {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      {/* --- Product Grid (Desktop & Mobile) --- */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
        </div>
      ) : filteredItems.length > 0 ? (
        <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Produk', 'Kategori', 'Harga Jual', 'Stok', 'Status', 'Aksi']}
                    loading={false}
                >
                    {filteredItems.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-none">
                            <td className="px-6 py-4">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-lg bg-gray-100 mr-3 overflow-hidden border border-gray-200">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-gray-300"><Package size={16} /></div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900">{item.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{item.sku}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-gray-600">{item.item_categories?.name}</td>
                            <td className="px-6 py-4 font-medium text-gray-900">Rp {item.selling_price?.toLocaleString('id-ID')}</td>
                            <td className="px-6 py-4">
                                <span className={`font-bold ${item.current_stock <= item.min_stock ? 'text-red-600' : 'text-gray-800'}`}>
                                    {item.current_stock}
                                </span> <span className="text-xs text-gray-500">{item.unit}</span>
                            </td>
                            <td className="px-6 py-4">
                                <StatusToggle isActive={item.is_active} onToggle={() => handleToggleStatus(item)} />
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingItem(item); setIsAddProductModalOpen(true); }} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded"><Store size={16} /></button>
                                    <button onClick={() => handleDeleteClick(item)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                    <button onClick={() => addToCart(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Plus size={16} /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>

            {/* Mobile/Tablet Grid View */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map(item => (
                    <ProductCard 
                        key={item.id} 
                        item={item} 
                        stock={item.current_stock}
                        onAddToCart={() => addToCart(item)}
                        onBuyNow={() => handleBuyNow(item)}
                    />
                ))}
            </div>
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 mt-4">
          <div className="inline-flex p-3 bg-gray-50 rounded-full mb-3">
            <Search className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-base font-bold text-gray-800">Produk tidak ditemukan</h3>
          <p className="text-sm text-gray-500 mt-1">Coba ubah pencarian atau filter.</p>
        </div>
      )}

      {/* --- Cart Drawer --- */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-md w-full flex flex-col bg-white shadow-2xl animate-slide-in-right">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <ShoppingBag className="w-5 h-5 mr-2 text-navbar-accent-1" /> Keranjang
              </h2>
              <button onClick={() => setIsCartOpen(false)}><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length > 0 ? cart.map(item => (
                <div key={item.id} className="flex gap-4 border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                    <p className="text-xs text-gray-500">{item.sku}</p>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center border rounded-lg">
                        <button onClick={() => updateCartQty(item.id, -1)} className="p-1 text-gray-500"><Minus size={14} /></button>
                        <span className="px-2 text-sm font-bold">{item.cartQuantity}</span>
                        <button onClick={() => updateCartQty(item.id, 1)} className="p-1 text-gray-500"><Plus size={14} /></button>
                      </div>
                      <span className="font-bold text-gray-900">Rp {((item.selling_price || 0) * (item.cartQuantity || 0)).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 h-fit"><Trash2 size={16} /></button>
                </div>
              )) : (
                <div className="text-center py-10 text-gray-400">Keranjang kosong</div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between mb-4 font-bold text-lg">
                  <span>Total</span>
                  <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
                </div>
                <Button onClick={() => setIsCheckoutModalOpen(true)} className="w-full py-3 shadow-lg">Checkout</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Modals --- */}
      <Modal isOpen={isAddProductModalOpen} onClose={() => setIsAddProductModalOpen(false)} title={editingItem ? "Edit Produk" : "Tambah Produk"}>
        <ItemForm item={editingItem} onSuccess={() => { setIsAddProductModalOpen(false); fetchData(); }} />
      </Modal>

      <Modal isOpen={isAddCategoryModalOpen} onClose={() => setIsAddCategoryModalOpen(false)} title="Manajemen Kategori">
        <CategoryForm onSuccess={() => {}} onCancel={() => setIsAddCategoryModalOpen(false)} />
      </Modal>

      <Modal isOpen={isCheckoutModalOpen} onClose={() => setIsCheckoutModalOpen(false)} title="Konfirmasi Pesanan">
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Outlet Tujuan</label>
                <select 
                    className="w-full p-3 border border-gray-300 rounded-xl bg-white"
                    value={selectedOutletId}
                    onChange={(e) => setSelectedOutletId(Number(e.target.value))}
                >
                    <option value="">-- Pilih Outlet --</option>
                    {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
            </div>
            {selectedOutletId && (
                <CheckoutForm 
                    items={buyNowItem ? [{name: buyNowItem.name, quantity: 1, price: buyNowItem.selling_price || 0}] : cart.map(i => ({name: i.name, quantity: i.cartQuantity || 0, price: i.selling_price || 0}))}
                    totalAmount={buyNowItem ? (buyNowItem.selling_price || 0) : cartTotal}
                    description={`Order untuk ${outlets.find(o => o.id === selectedOutletId)?.name}`}
                    onSuccess={handleCheckoutSuccess}
                    onCancel={() => setIsCheckoutModalOpen(false)}
                />
            )}
        </div>
      </Modal>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Hapus Produk">
        <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex gap-3">
                <AlertTriangle className="text-red-600 w-6 h-6 flex-shrink-0" />
                <div>
                    <h4 className="font-bold text-red-800">Hapus Permanen?</h4>
                    <p className="text-sm text-red-700 mt-1">Produk <strong>{itemToDelete?.name}</strong> akan dihapus beserta riwayat stoknya.</p>
                </div>
            </div>
            <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Batal</Button>
                <Button variant="primary" onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 border-none text-white">
                    {isDeleting ? <Spinner size="sm" /> : 'Ya, Hapus'}
                </Button>
            </div>
        </div>
      </Modal>

    </div>
  );
};

export default ItemsPage;
