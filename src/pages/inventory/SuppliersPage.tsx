import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Supplier } from '../../types/database';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import { Edit, Trash2, Search, Phone, Mail, User, Plus } from 'lucide-react';
import SupplierForm from '../../components/inventory/SupplierForm'; 
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';

// Removed PageHeader from internal component to fit nicely in Settings tab
// Or keep it but make it optional/styled differently if needed.
// For now, we'll simplify the header since SettingsPage already has a main header.

const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      toast.error(error.message);
    } else {
      setSuppliers(data);
      setFilteredSuppliers(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = suppliers.filter(sup => 
        sup.name.toLowerCase().includes(lowerQuery) || 
        sup.contact_person?.toLowerCase().includes(lowerQuery) ||
        sup.email?.toLowerCase().includes(lowerQuery)
      );
      setFilteredSuppliers(filtered);
    } else {
      setFilteredSuppliers(suppliers);
    }
  }, [searchQuery, suppliers]);

  const handleOpenModal = (supplier: Supplier | null = null) => {
    setSelectedSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSupplier(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    fetchSuppliers();
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Supplier deleted successfully.');
        fetchSuppliers();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Internal Header for the Tab */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800">Daftar Supplier</h3>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cari supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/50 focus:border-navbar-accent-1 transition-all"
            />
          </div>
          <Button onClick={() => handleOpenModal()} variant="primary" className="shadow-lg shadow-navbar-accent-1/20 flex items-center justify-center">
            <Plus size={16} className="mr-2" /> Tambah Supplier
          </Button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <Table
          headers={['Nama', 'Kontak Person', 'Telepon', 'Email', 'Aksi']}
          loading={loading}
          emptyStateMessage="Belum ada supplier."
        >
          {filteredSuppliers.map((supplier) => (
            <tr key={supplier.id} className="group hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-none">
              <td className="px-6 py-4 font-semibold text-gray-900">{supplier.name}</td>
              <td className="px-6 py-4">
                {supplier.contact_person ? (
                  <div className="flex items-center text-gray-600">
                    <User size={14} className="mr-2 text-gray-400" />
                    {supplier.contact_person}
                  </div>
                ) : '-'}
              </td>
              <td className="px-6 py-4">
                {supplier.phone ? (
                  <div className="flex items-center text-gray-600">
                    <Phone size={14} className="mr-2 text-gray-400" />
                    {supplier.phone}
                  </div>
                ) : '-'}
              </td>
              <td className="px-6 py-4">
                {supplier.email ? (
                  <div className="flex items-center text-gray-600">
                    <Mail size={14} className="mr-2 text-gray-400" />
                    {supplier.email}
                  </div>
                ) : '-'}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button 
                    onClick={() => handleOpenModal(supplier)} 
                    className="p-1.5 text-gray-500 hover:text-navbar-accent-1 hover:bg-navbar-accent-1/10 rounded-md transition-colors"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(supplier.id)} 
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={18} />
                  </button>
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
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : filteredSuppliers.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredSuppliers.map((supplier) => (
              <Card key={supplier.id} className="p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-lg text-gray-900 mb-3">{supplier.name}</h3>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center text-gray-600">
                    <User size={14} className="mr-2 text-gray-400" />
                    <span>{supplier.contact_person || 'N/A'}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Phone size={14} className="mr-2 text-gray-400" />
                    <span>{supplier.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Mail size={14} className="mr-2 text-gray-400" />
                    <span>{supplier.email || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-3 pt-2 border-t border-gray-50">
                  <button 
                    onClick={() => handleOpenModal(supplier)} 
                    className="flex items-center text-sm text-gray-600 hover:text-navbar-accent-1 font-medium transition-colors"
                  >
                    <Edit size={16} className="mr-1" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(supplier.id)} 
                    className="flex items-center text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                  >
                    <Trash2 size={16} className="mr-1" /> Hapus
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">Belum ada supplier.</p>
          </div>
        )}
      </div>
      
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={selectedSupplier ? 'Edit Supplier' : 'Tambah Supplier Baru'}
      >
        <SupplierForm onSuccess={handleSuccess} supplier={selectedSupplier} />
      </Modal>
    </div>
  );
};

export default SuppliersPage;
