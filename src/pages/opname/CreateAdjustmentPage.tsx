import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types/database';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Calendar, Trash2, ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';
import SearchItem from '../../components/ui/SearchItem'; // Import komponen baru

interface OpnameLineItem extends Item {
  system_stock: number;
  physical_stock: number | null;
}

const CreateAdjustmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [opnameDate, setOpnameDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [selectedItems, setSelectedItems] = useState<OpnameLineItem[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchAllItems = async () => {
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('is_active', true)
          .order('name');
          
        if (error) throw error;
        setAllItems(data as Item[]);
      } catch (error: any) {
        toast.error('Failed to load items list.');
        console.error(error);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchAllItems();
  }, []);

  const handleAddItem = async (item: Item) => {
    // Cek jika item sudah ada
    if (selectedItems.some(i => i.id === item.id)) {
      toast.warning(`${item.name} sudah ada dalam daftar.`);
      return;
    }

    let systemStock = 0;
    try {
        const { data, error } = await supabase.rpc('get_item_stock', {
            p_item_id: item.id
        });
        
        if (error) {
            console.error("Error fetching stock:", error);
        } else {
            systemStock = data || 0;
        }
    } catch (err) {
        console.error(err);
    }

    setSelectedItems(prev => [
      ...prev,
      { ...item, system_stock: systemStock, physical_stock: null },
    ]);
    toast.success(`${item.name} ditambahkan.`);
  };
  
  const handleRemoveItem = (itemId: number) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handlePhysicalStockChange = (itemId: number, value: string) => {
    if (value && parseFloat(value) < 0) return;
    
    const newStock = value === '' ? null : parseFloat(value);
    setSelectedItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, physical_stock: newStock } : item
      )
    );
  };

  const getVariance = (item: OpnameLineItem) => {
    if (item.physical_stock === null) return 0;
    return item.physical_stock - item.system_stock;
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.error("Mohon tambahkan setidaknya satu item.");
      return;
    }

    const incompleteItems = selectedItems.filter(item => item.physical_stock === null);
    if (incompleteItems.length > 0) {
        toast.error(`Mohon isi stok fisik untuk: ${incompleteItems.map(i => i.name).join(', ')}`);
        return;
    }

    setIsSubmitting(true);
    try {
      const { data: locations } = await supabase.from('locations').select('id').limit(1);
      const fallbackLocationId = locations?.[0]?.id;

      if (!fallbackLocationId) {
          throw new Error("System Error: Lokasi default tidak ditemukan.");
      }

      const movementsToInsert = selectedItems
        .map(item => {
          const variance = getVariance(item);
          return {
            item_id: item.id,
            location_id: fallbackLocationId,
            quantity_change: variance,
            movement_type: 'manual_adjustment' as const,
            note: notes || `Manual adjustment on ${opnameDate}`,
            created_by: user?.id,
          };
        });

      const effectiveMovements = movementsToInsert.filter(m => m.quantity_change !== 0);

      if (effectiveMovements.length === 0) {
        toast.info("Tidak ada selisih stok yang perlu disesuaikan.");
        navigate('/opname/sessions');
        return;
      }

      const { error } = await supabase.from('stock_movements').insert(effectiveMovements);
      if (error) throw error;

      toast.success(`Berhasil menyesuaikan stok untuk ${effectiveMovements.length} item.`);
      navigate('/opname/sessions');

    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(`Gagal menyimpan penyesuaian: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <>
      <PageHeader title="Buat Penyesuaian Stok (Manual)">
        <Button onClick={() => navigate('/opname/sessions')} variant="secondary" className="w-auto flex items-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700">
          <ArrowLeft size={16} className="mr-2" /> Kembali
        </Button>
      </PageHeader>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label htmlFor="opname-date" className="block text-sm font-semibold text-gray-700 mb-1.5">Tanggal</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="opname-date"
                type="date"
                value={opnameDate}
                onChange={(e) => setOpnameDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 text-gray-900 shadow-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="created-by" className="block text-sm font-semibold text-gray-700 mb-1.5">Dibuat Oleh</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="created-by"
                type="text"
                value={user?.full_name || user?.email || 'Unknown User'}
                readOnly
                disabled
                className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed focus:outline-none shadow-sm"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-1.5">Catatan (Opsional)</label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 text-gray-900 shadow-sm transition-all"
              placeholder="Tambahkan catatan relevan di sini..."
            />
          </div>
        </div>

        {/* --- IMPLEMENTASI KOMPONEN SEARCHITEM BARU --- */}
        <div className="mb-8">
          <SearchItem<Item>
            label="Cari dan Tambah Item"
            placeholder={loadingItems ? "Memuat item..." : "Ketik nama barang atau SKU..."}
            items={allItems}
            disabled={loadingItems}
            clearOnSelect={true}
            onSelect={handleAddItem}
            filterFunction={(item, query) => {
              const lowerQuery = query.toLowerCase();
              return (
                item.name.toLowerCase().includes(lowerQuery) ||
                (item.sku ? item.sku.toLowerCase().includes(lowerQuery) : false)
              );
            }}
            renderOption={(item) => (
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{item.sku || 'No SKU'}</div>
                </div>
                <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  {item.unit}
                </div>
              </div>
            )}
          />
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-hidden border border-gray-200 rounded-lg shadow-sm">
            <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs font-bold text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th scope="col" className="px-6 py-4">Item</th>
                        <th scope="col" className="px-6 py-4 text-right">Stok Sistem</th>
                        <th scope="col" className="px-6 py-4 text-center">Stok Fisik</th>
                        <th scope="col" className="px-6 py-4 text-right">Selisih</th>
                        <th scope="col" className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {selectedItems.length > 0 ? selectedItems.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900">
                                {item.name}
                                <span className="block text-xs text-gray-500 mt-0.5">{item.sku || 'No SKU'}</span>
                            </td>
                            <td className="px-6 py-4 text-right text-gray-700 font-medium">{item.system_stock} <span className="text-gray-400 font-normal text-xs">{item.unit}</span></td>
                            <td className="px-6 py-4 text-center">
                                <input 
                                    type="number"
                                    min="0"
                                    value={item.physical_stock ?? ''}
                                    onChange={(e) => handlePhysicalStockChange(item.id, e.target.value)}
                                    className="w-24 px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 text-gray-900 text-center font-medium shadow-sm"
                                    placeholder="0"
                                />
                            </td>
                            <td className={`px-6 py-4 text-right font-bold ${getVarianceColor(getVariance(item))}`}>
                                {getVariance(item) > 0 ? '+' : ''}{getVariance(item)}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button onClick={() => handleRemoveItem(item.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-red-50">
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="text-center p-12">
                                <div className="flex flex-col items-center justify-center text-gray-400">
                                    <p className="font-medium text-gray-500">Belum ada item dipilih.</p>
                                    <p className="text-sm mt-1">Gunakan pencarian di atas untuk menambahkan item.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Mobile Cards */}
        <div className="block lg:hidden space-y-4">
          {selectedItems.length > 0 ? selectedItems.map(item => {
              const variance = getVariance(item);
              return (
                  <Card key={item.id} className="p-4 border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="font-bold text-lg text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.sku || 'No SKU'}</p>
                          </div>
                          <button onClick={() => handleRemoveItem(item.id)} className="text-gray-400 hover:text-red-600 p-1">
                              <Trash2 size={20} />
                          </button>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3 items-end">
                          <div className="text-center">
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sistem</p>
                              <p className="font-semibold text-gray-800">{item.system_stock} <span className="text-xs font-normal">{item.unit}</span></p>
                          </div>
                          <div>
                              <label className="text-xs text-gray-500 uppercase tracking-wide text-center block mb-1">Fisik</label>
                              <input
                                  type="number"
                                  min="0"
                                  value={item.physical_stock ?? ''}
                                  onChange={(e) => handlePhysicalStockChange(item.id, e.target.value)}
                                  className="w-full p-1.5 border border-gray-300 rounded-md text-center font-bold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
                                  placeholder="0"
                              />
                          </div>
                          <div className="text-center">
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Selisih</p>
                              <p className={`font-bold ${getVarianceColor(variance)}`}>
                                  {variance > 0 ? '+' : ''}{variance}
                              </p>
                          </div>
                      </div>
                  </Card>
              )
          }) : (
              <div className="text-center p-8 text-gray-500 border border-dashed border-gray-300 rounded-xl bg-gray-50">
                <p>Belum ada item dipilih.</p>
                <p className="text-sm mt-1">Gunakan pencarian di atas untuk menambahkan item.</p>
              </div>
          )}
        </div>

        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-100">
            <Button variant="secondary" onClick={() => navigate('/opname/sessions')} disabled={isSubmitting} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700">Batal</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting} className="shadow-lg shadow-navbar-accent-1/20">
              {isSubmitting ? <Spinner /> : 'Simpan Penyesuaian'}
            </Button>
        </div>
      </Card>
    </>
  );
};

export default CreateAdjustmentPage;
