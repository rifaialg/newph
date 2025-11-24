import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Outlet } from '../../types/database';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Table from '../../components/ui/Table';
import { Edit, MapPin, Phone, User, Mail, Plus, Lock, Trash2, AlertTriangle } from 'lucide-react';
import StatusToggle from '../../components/ui/StatusToggle';
import AddOutletForm from '../../components/outlet/AddOutletForm';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';

const OutletsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Selection States
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null); // For Edit
  const [outletToDelete, setOutletToDelete] = useState<Outlet | null>(null); // For Delete
  const [isDeleting, setIsDeleting] = useState(false);
  
  // RBAC Check
  const canManageOutlets = hasPermission('manage_users'); // Only Owner
  const canViewOutlets = hasPermission('manage_inventory'); // Staff & Owner

  const fetchOutlets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setOutlets(data as Outlet[]);
    } catch (error: any) {
      toast.error('Gagal memuat data outlet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canViewOutlets) {
      fetchOutlets();
    } else {
      setLoading(false);
    }
  }, [fetchOutlets, canViewOutlets]);

  const toggleActive = async (outlet: Outlet) => {
    if (!canManageOutlets) {
      toast.error("Anda tidak memiliki izin untuk mengubah status outlet.");
      return;
    }

    // Optimistic Update for Status
    setOutlets(prev => prev.map(o => o.id === outlet.id ? { ...o, is_active: !o.is_active } : o));

    const { error } = await supabase
      .from('outlets')
      .update({ is_active: !outlet.is_active })
      .eq('id', outlet.id);
      
    if (error) {
      // Revert if failed
      setOutlets(prev => prev.map(o => o.id === outlet.id ? { ...o, is_active: outlet.is_active } : o));
      toast.error(error.message);
    } else {
      toast.success(`Status Outlet ${outlet.name} diperbarui.`);
    }
  };

  // --- Handlers ---

  const handleAdd = () => {
    setSelectedOutlet(null); // Reset selection for new entry
    setIsFormModalOpen(true);
  };

  const handleEdit = (outlet: Outlet) => {
    setSelectedOutlet(outlet);
    setIsFormModalOpen(true);
  };

  const handleDeleteClick = (outlet: Outlet) => {
    // Kita izinkan hapus meskipun aktif, tapi beri peringatan di modal
    setOutletToDelete(outlet);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!outletToDelete) return;
    setIsDeleting(true);
    try {
        const { error } = await supabase
            .from('outlets')
            .delete()
            .eq('id', outletToDelete.id);

        if (error) throw error;

        toast.success(`Outlet "${outletToDelete.name}" berhasil dihapus.`);
        
        // Optimistic Update: Hapus dari state lokal agar UI responsif
        setOutlets(currentOutlets => currentOutlets.filter(o => o.id !== outletToDelete.id));
        
        setIsDeleteModalOpen(false);
        setOutletToDelete(null);
        
    } catch (error: any) {
        console.error("Delete error:", error);
        if (error.code === '23503') {
            toast.error(`Gagal menghapus: Outlet ini masih memiliki data terkait (transaksi/stok).`);
        } else {
            toast.error(`Gagal menghapus: ${error.message}`);
        }
        // Refresh data jika gagal untuk mengembalikan state yang benar
        fetchOutlets();
    } finally {
        setIsDeleting(false);
    }
  };

  if (!canViewOutlets && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] text-center bg-white rounded-xl border border-gray-100">
        <div className="bg-gray-50 p-4 rounded-full mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Akses Dibatasi</h2>
        <p className="text-gray-500 mt-2">Anda tidak memiliki izin untuk melihat halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Internal Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800">Manajemen Outlet</h3>
        {canManageOutlets && (
          <Button 
            onClick={handleAdd} 
            variant="primary" 
            className="shadow-lg shadow-navbar-accent-1/20 flex items-center justify-center w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Outlet
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <Table
          headers={['Nama Outlet', 'Manajer / PIC', 'Kontak', 'Status', 'Aksi']}
          loading={loading}
          emptyStateMessage="Belum ada outlet terdaftar."
        >
          {outlets.map((outlet) => (
            <tr key={outlet.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-none">
              <td className="px-6 py-4">
                <div className="font-semibold text-gray-900">{outlet.name}</div>
                {outlet.address && (
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <MapPin className="w-3 h-3 mr-1" />
                    {outlet.address}
                  </div>
                )}
                {/* Indikator Akun */}
                {outlet.login_username && (
                  <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                    <User className="w-3 h-3 mr-1" /> {outlet.login_username}
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-gray-600">
                <div className="flex items-center">
                  <User className="w-3.5 h-3.5 mr-2 text-gray-400" />
                  {outlet.manager_name || '-'}
                </div>
              </td>
              <td className="px-6 py-4 text-gray-600 text-sm space-y-1">
                <div className="flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-2 text-gray-400" />
                  {outlet.email || '-'}
                </div>
                <div className="flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                  {outlet.phone || '-'}
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${outlet.is_active ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20' : 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/20'}`}>
                  {outlet.is_active ? 'Aktif' : 'Non-aktif'}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center space-x-2">
                  {canManageOutlets ? (
                    <>
                      <StatusToggle 
                        isActive={outlet.is_active} 
                        onToggle={() => toggleActive(outlet)} 
                      />
                      
                      {/* Tombol Edit */}
                      <button 
                        onClick={() => handleEdit(outlet)}
                        className="p-1.5 text-gray-500 hover:text-navbar-accent-1 hover:bg-navbar-accent-1/10 rounded-md transition-colors"
                        title="Edit Detail & Akses"
                      >
                        <Edit size={18} />
                      </button>

                      {/* Tombol Hapus */}
                      <button 
                        onClick={() => handleDeleteClick(outlet)}
                        className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors"
                        title="Hapus Outlet"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Read Only</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Add/Edit Outlet Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={selectedOutlet ? `Edit Outlet: ${selectedOutlet.name}` : "Tambah Outlet Baru"}
      >
        <AddOutletForm 
          outletToEdit={selectedOutlet}
          onSuccess={() => {
            setIsFormModalOpen(false);
            fetchOutlets();
          }}
          onCancel={() => setIsFormModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus Outlet"
      >
        <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-red-800">Konfirmasi Penghapusan</h4>
                    <p className="text-sm text-red-700 mt-1">
                        Anda akan menghapus outlet <strong>"{outletToDelete?.name}"</strong>.
                    </p>
                    {outletToDelete?.is_active && (
                        <p className="text-xs font-bold text-red-800 mt-2 bg-red-100/50 p-1 rounded">
                            PERHATIAN: Outlet ini masih berstatus AKTIF.
                        </p>
                    )}
                    <p className="text-xs text-red-600 mt-2">
                        Tindakan ini akan menghapus data outlet dari sistem. Pastikan tidak ada data transaksi penting yang tertinggal.
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

    </div>
  );
};

export default OutletsPage;
