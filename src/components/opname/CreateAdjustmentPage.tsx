import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types/database';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Calendar, Search, Trash2, ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';

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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAllItems = async () => {
      setLoadingItems(true);
      const { data, error } = await supabase.from('items').select('*').eq('is_active', true);
      if (error) {
        toast.error('Failed to load items list.');
      } else {
        setAllItems(data as Item[]);
      }
      setLoadingItems(false);
    };
    fetchAllItems();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 0) {
      const selectedIds = new Set(selectedItems.map(item => item.id));
      const results = allItems
        .filter(item => !selectedIds.has(item.id))
        .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
      setFilteredItems(results);
    } else {
      setFilteredItems([]);
    }
  }, [searchQuery, allItems, selectedItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAddItem = async (item: Item) => {
    setSearchQuery('');
    setIsDropdownOpen(false);

    let systemStock = 0;
    if (item.default_location_id) {
      const { data, error } = await supabase.rpc('get_item_stock_at_location', {
        p_item_id: item.id,
        p_location_id: item.default_location_id,
      });
      if (error) toast.error(`Could not fetch stock for ${item.name}.`);
      else systemStock = data;
    } else {
      toast.warning(`${item.name} has no default location. System stock is assumed to be 0.`);
    }

    setSelectedItems(prev => [
      ...prev,
      { ...item, system_stock: systemStock, physical_stock: null },
    ]);
  };
  
  const handleRemoveItem = (itemId: number) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handlePhysicalStockChange = (itemId: number, value: string) => {
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
      toast.error("Please add at least one item to adjust.");
      return;
    }

    setIsSubmitting(true);
    try {
      const movementsToInsert = selectedItems
        .filter(item => item.physical_stock !== null && getVariance(item) !== 0)
        .map(item => {
          if (!item.default_location_id) {
            throw new Error(`Item "${item.name}" does not have a default location set.`);
          }
          return {
            item_id: item.id,
            location_id: item.default_location_id,
            quantity_change: getVariance(item),
            movement_type: 'manual_adjustment' as const,
            note: notes || `Manual adjustment on ${opnameDate}`,
            created_by: user?.id,
          };
        });

      if (movementsToInsert.length === 0) {
        toast.info("No changes to save.");
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from('stock_movements').insert(movementsToInsert);
      if (error) throw error;

      toast.success("Stock adjustment saved successfully!");
      navigate('/opname/sessions');

    } catch (error: any) {
      toast.error(`Failed to save adjustment: ${error.message}`);
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
      <PageHeader title="Create Stock Adjustment">
        <Button onClick={() => navigate('/opname/sessions')} variant="secondary" className="w-auto flex items-center">
          <ArrowLeft size={16} className="mr-2" /> Back to Sessions
        </Button>
      </PageHeader>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label htmlFor="opname-date" className="block text-sm font-medium text-gray-700">Date</label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="opname-date"
                type="date"
                value={opnameDate}
                onChange={(e) => setOpnameDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-navbar-accent-1 focus:shadow-glow-gold transition-shadow duration-300 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="created-by" className="block text-sm font-medium text-gray-700">Created By</label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="created-by"
                type="text"
                value={user?.full_name || user?.email || 'Unknown User'}
                readOnly
                disabled
                className="w-full pl-10 pr-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-500 cursor-not-allowed focus:outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-navbar-accent-1 focus:shadow-glow-gold transition-shadow duration-300 text-gray-900"
            />
          </div>
        </div>

        <div className="mb-6" ref={searchContainerRef}>
          <label htmlFor="search-item" className="block text-sm font-medium text-gray-700">Search and Add Item</label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="search-item"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder={loadingItems ? "Loading items..." : "Type to search for an item..."}
              disabled={loadingItems}
              autoComplete="off"
              className="w-full pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-navbar-accent-1 focus:shadow-glow-gold transition-shadow duration-300 text-gray-900"
            />
          </div>
          {isDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full md:w-1/2 rounded-md bg-white shadow-lg border border-gray-200">
              <ul className="max-h-60 overflow-auto rounded-md py-1 text-base">
                {loadingItems ? (
                  <li className="px-4 py-2 text-gray-500">Loading...</li>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <li key={item.id} onClick={() => handleAddItem(item)} className="relative cursor-pointer select-none py-2 px-4 text-gray-900 hover:bg-sidebar-hover-accent hover:text-sidebar-accent">
                      {item.name}
                    </li>
                  ))
                ) : searchQuery ? (
                  <li className="px-4 py-2 text-gray-500">Item not found</li>
                ) : null}
              </ul>
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="block lg:hidden space-y-4">
          {selectedItems.length > 0 ? selectedItems.map(item => {
              const variance = getVariance(item);
              return (
                  <Card key={item.id} className="p-4 border border-gray-200">
                      <div className="flex justify-between items-start">
                          <div>
                              <p className="font-bold text-lg text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-500">{item.sku || 'No SKU'}</p>
                          </div>
                          <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 p-1">
                              <Trash2 size={20} />
                          </button>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 items-end">
                          <div className="text-center">
                              <p className="text-xs text-gray-500">System</p>
                              <p className="font-semibold text-gray-800">{item.system_stock} {item.unit}</p>
                          </div>
                          <div>
                              <label className="text-xs text-gray-500 text-center block">Physical</label>
                              <input
                                  type="number"
                                  value={item.physical_stock ?? ''}
                                  onChange={(e) => handlePhysicalStockChange(item.id, e.target.value)}
                                  className="w-full mt-1 p-1 border rounded-md text-center font-bold text-gray-900 bg-white focus:outline-none focus:ring-0 focus:border-navbar-accent-1"
                              />
                          </div>
                          <div className="text-center">
                              <p className="text-xs text-gray-500">Variance</p>
                              <p className={`font-bold ${getVarianceColor(variance)}`}>
                                  {variance > 0 ? '+' : ''}{variance}
                              </p>
                          </div>
                      </div>
                  </Card>
              )
          }) : (
              <div className="text-center p-8 text-gray-500 border-dashed border-2 border-gray-300 rounded-lg">
                <p>No items selected yet.</p>
                <p className="text-sm">Use the search bar above to add items.</p>
              </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3">Item</th>
                        <th scope="col" className="px-6 py-3 text-right">System Stock</th>
                        <th scope="col" className="px-6 py-3">Physical Stock</th>
                        <th scope="col" className="px-6 py-3 text-right">Variance</th>
                        <th scope="col" className="px-6 py-3">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {selectedItems.length > 0 ? selectedItems.map(item => (
                        <tr key={item.id} className="bg-white border-b">
                            <td className="px-6 py-4 font-medium text-gray-900">
                                {item.name}
                                <span className="block text-xs text-gray-500">{item.sku || 'No SKU'}</span>
                            </td>
                            <td className="px-6 py-4 text-right text-gray-700">{item.system_stock} {item.unit}</td>
                            <td className="px-6 py-4">
                                <input 
                                    type="number"
                                    value={item.physical_stock ?? ''}
                                    onChange={(e) => handlePhysicalStockChange(item.id, e.target.value)}
                                    className="w-24 px-2 py-1 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-navbar-accent-1 text-gray-900"
                                />
                            </td>
                            <td className={`px-6 py-4 text-right font-bold ${getVarianceColor(getVariance(item))}`}>
                                {getVariance(item) > 0 ? '+' : ''}{getVariance(item)}
                            </td>
                            <td className="px-6 py-4">
                                <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="text-center p-8">
                                <div className="text-center p-8 text-gray-500 border-dashed border-2 border-gray-300 rounded-lg">
                                    <p>No items selected yet.</p>
                                    <p className="text-sm">Use the search bar above to add items.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        <div className="flex justify-end space-x-4 mt-8">
            <Button variant="secondary" onClick={() => navigate('/opname/sessions')} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : 'Save Adjustment'}
            </Button>
        </div>
      </Card>
    </>
  );
};

export default CreateAdjustmentPage;
