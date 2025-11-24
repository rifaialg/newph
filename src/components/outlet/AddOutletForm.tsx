import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { 
  Store, MapPin, Phone, User, Mail, Lock, Eye, EyeOff, 
  Shield, LayoutDashboard, ShoppingBag, ArrowDownCircle, 
  ArrowUpCircle, ClipboardList, Calculator, BarChart, CheckSquare, Square
} from 'lucide-react';
import { OutletPermissions, Outlet } from '../../types/database';

// --- 1. Schema Validasi Dinamis ---
const getOutletSchema = (isEdit: boolean) => z.object({
  name: z.string().min(3, 'Nama outlet minimal 3 karakter'),
  address: z.string().min(5, 'Alamat wajib diisi'),
  manager_name: z.string().min(2, 'Nama PIC wajib diisi'),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit').regex(/^\d+$/, 'Hanya angka diperbolehkan'),
  email: z.string().email('Format email tidak valid'),
  // Password wajib saat create, opsional saat edit
  password: isEdit 
    ? z.string().optional().refine(val => !val || val.length >= 8, "Password baru minimal 8 karakter")
    : z.string().min(8, 'Password minimal 8 karakter'),
  permissions: z.object({
    dashboard: z.boolean(),
    inventory_items: z.boolean(),
    incoming_stock: z.boolean(),
    outgoing_stock: z.boolean(),
    opname: z.boolean(),
    calculator: z.boolean(),
    reports: z.boolean(),
    manage_outlets: z.boolean().optional(),
    allowed_outlet_ids: z.array(z.number()).optional(),
  })
});

// Tipe data akan diinfer dari schema saat runtime, tapi kita butuh tipe statis untuk form hook
// Kita gunakan tipe yang paling longgar (semua field ada) untuk definisi interface
type OutletFormData = {
  name: string;
  address: string;
  manager_name: string;
  phone: string;
  email: string;
  password?: string;
  permissions: OutletPermissions;
};

interface AddOutletFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  outletToEdit?: Outlet | null; // Prop untuk mode Edit
}

// --- 2. Konfigurasi Permission UI ---
const PERMISSION_CONFIG: { key: keyof OutletPermissions; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Ringkasan metrik' },
  { key: 'inventory_items', label: 'Stok & Produk', icon: ShoppingBag, desc: 'Akses katalog' },
  { key: 'incoming_stock', label: 'Barang Masuk', icon: ArrowDownCircle, desc: 'Input pembelian' },
  { key: 'outgoing_stock', label: 'Distribusi / POS', icon: ArrowUpCircle, desc: 'Input penjualan' },
  { key: 'opname', label: 'Stok Opname', icon: ClipboardList, desc: 'Audit stok fisik' },
  { key: 'calculator', label: 'Kalkulator HPP', icon: Calculator, desc: 'Hitung modal' },
  { key: 'reports', label: 'Laporan', icon: BarChart, desc: 'Analisa data' },
  { key: 'manage_outlets', label: 'Manajemen Outlet', icon: Store, desc: 'Akses data outlet lain' },
];

const AddOutletForm: React.FC<AddOutletFormProps> = ({ onSuccess, onCancel, outletToEdit }) => {
  const isEditMode = !!outletToEdit;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [availableOutlets, setAvailableOutlets] = useState<Outlet[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<OutletFormData>({
    resolver: zodResolver(getOutletSchema(isEditMode)),
    defaultValues: {
      permissions: {
        dashboard: true,
        inventory_items: true,
        incoming_stock: true,
        outgoing_stock: true,
        opname: true,
        calculator: false,
        reports: false,
        manage_outlets: false,
        allowed_outlet_ids: []
      }
    }
  });

  const watchedPermissions = watch('permissions');

  // Initialize form with existing data if in Edit Mode
  useEffect(() => {
    if (outletToEdit) {
      reset({
        name: outletToEdit.name,
        address: outletToEdit.address || '',
        manager_name: outletToEdit.manager_name || '',
        phone: outletToEdit.phone || '',
        email: outletToEdit.email || '',
        password: '', // Password always blank on edit
        permissions: outletToEdit.permissions || {
          dashboard: true,
          inventory_items: true,
          incoming_stock: true,
          outgoing_stock: true,
          opname: true,
          calculator: false,
          reports: false,
          manage_outlets: false,
          allowed_outlet_ids: []
        }
      });
    }
  }, [outletToEdit, reset]);

  // Fetch existing outlets for the multi-select
  useEffect(() => {
    const fetchOutlets = async () => {
      let query = supabase.from('outlets').select('id, name').eq('is_active', true);
      if (outletToEdit) {
        query = query.neq('id', outletToEdit.id); // Exclude self in edit mode
      }
      const { data } = await query;
      setAvailableOutlets(data || []);
    };
    fetchOutlets();
  }, [outletToEdit]);

  const handleTogglePermission = (key: keyof OutletPermissions) => {
    setValue(`permissions.${key}`, !watchedPermissions[key], { shouldDirty: true });
    
    // Reset allowed_outlet_ids if manage_outlets is turned off
    if (key === 'manage_outlets' && watchedPermissions[key] === true) {
        setValue('permissions.allowed_outlet_ids', []);
    }
  };

  const handleToggleOutletId = (id: number) => {
    const currentIds = watchedPermissions.allowed_outlet_ids || [];
    if (currentIds.includes(id)) {
        setValue('permissions.allowed_outlet_ids', currentIds.filter(oid => oid !== id));
    } else {
        setValue('permissions.allowed_outlet_ids', [...currentIds, id]);
    }
  };

  const onSubmit = async (data: OutletFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name,
        address: data.address,
        manager_name: data.manager_name,
        phone: data.phone,
        email: data.email,
        login_username: data.email, // Sync username with email
        permissions: data.permissions,
        is_active: true
      };

      if (isEditMode && outletToEdit) {
        // UPDATE
        const { error } = await supabase
          .from('outlets')
          .update(payload)
          .eq('id', outletToEdit.id);

        if (error) throw error;
        toast.success(`Outlet "${data.name}" berhasil diperbarui!`);
      } else {
        // INSERT
        const { error } = await supabase
          .from('outlets')
          .insert(payload);

        if (error) throw error;
        toast.success(`Outlet "${data.name}" berhasil dibuat!`);
      }

      // Handle Password Update (Placeholder for Auth Logic)
      if (data.password) {
        console.log(`${isEditMode ? 'Update' : 'Create'} password for user:`, data.email);
        // In real implementation: call Edge Function to update Supabase Auth user
      }

      reset();
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(`Gagal memproses: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all shadow-sm text-sm";
  const errorClass = "text-red-500 text-xs mt-1 ml-1 font-medium flex items-center gap-1";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* KOLOM KIRI: Data Outlet */}
        <div className="space-y-5">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-2">
            <h4 className="text-sm font-bold text-gray-800 flex items-center">
              <Store className="w-4 h-4 mr-2 text-navbar-accent-1" />
              Informasi Outlet
            </h4>
          </div>

          {/* Nama Outlet */}
          <div>
            <label className={labelClass}>Nama Outlet <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Store className="h-4 w-4 text-gray-400" />
              </div>
              <input
                {...register('name')}
                placeholder="Contoh: Artirasa Cabang Selatan"
                className={`${inputClass} ${errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
              />
            </div>
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          {/* Alamat */}
          <div>
            <label className={labelClass}>Alamat Lengkap <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none">
                <MapPin className="h-4 w-4 text-gray-400" />
              </div>
              <textarea
                {...register('address')}
                rows={3}
                placeholder="Jl. Contoh No. 123, Jakarta"
                className={`${inputClass} pl-10 resize-none ${errors.address ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
              />
            </div>
            {errors.address && <p className={errorClass}>{errors.address.message}</p>}
          </div>

          {/* Nama PIC */}
          <div>
            <label className={labelClass}>Nama PIC / Manajer <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input
                {...register('manager_name')}
                placeholder="Nama Penanggung Jawab"
                className={`${inputClass} ${errors.manager_name ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
              />
            </div>
            {errors.manager_name && <p className={errorClass}>{errors.manager_name.message}</p>}
          </div>

          {/* Telepon */}
          <div>
            <label className={labelClass}>Nomor Telepon <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="tel"
                {...register('phone')}
                placeholder="08123456789"
                className={`${inputClass} ${errors.phone ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
              />
            </div>
            {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
          </div>
        </div>

        {/* KOLOM KANAN: Akun & Akses */}
        <div className="space-y-5">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
            <h4 className="text-sm font-bold text-blue-800 flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Akun & Hak Akses
            </h4>
          </div>

          {/* Email (Username) */}
          <div>
            <label className={labelClass}>Email Login (Username) <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="email"
                {...register('email')}
                placeholder="outlet@artirasa.co.id"
                className={`${inputClass} ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
              />
            </div>
            {errors.email && <p className={errorClass}>{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className={labelClass}>
              {isEditMode ? 'Password Login (Opsional)' : 'Password Login'} 
              {!isEditMode && <span className="text-red-500"> *</span>}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                {...register('password')}
                placeholder={isEditMode ? "Kosongkan jika tidak ingin mengubah" : "Minimal 8 karakter"}
                className={`${inputClass} pr-10 ${errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className={errorClass}>{errors.password.message}</p>}
          </div>

          {/* Permissions Grid */}
          <div>
            <label className={labelClass}>Detail Hak Akses</label>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 max-h-80 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                {PERMISSION_CONFIG.map((perm) => {
                  const isChecked = watchedPermissions[perm.key];
                  const Icon = perm.icon;
                  const isManageOutlets = perm.key === 'manage_outlets';
                  
                  return (
                    <div key={perm.key} className="space-y-2">
                        <div 
                        onClick={() => handleTogglePermission(perm.key)}
                        className={`
                            flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all duration-200 select-none
                            ${isChecked 
                            ? 'bg-white border-green-200 shadow-sm' 
                            : 'bg-gray-100 border-transparent opacity-60 hover:opacity-100'
                            }
                        `}
                        >
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-md ${isChecked ? 'bg-green-50 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                            <Icon size={16} />
                            </div>
                            <div>
                            <span className={`block text-xs font-bold ${isChecked ? 'text-gray-900' : 'text-gray-500'}`}>
                                {perm.label}
                            </span>
                            <span className="text-[10px] text-gray-400">{perm.desc}</span>
                            </div>
                        </div>
                        
                        {/* Custom Toggle Switch */}
                        <div className={`
                            w-9 h-5 rounded-full flex items-center transition-colors duration-300 px-0.5
                            ${isChecked ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}
                        `}>
                            <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                        </div>
                        </div>

                        {/* Conditional Outlet Selection for 'manage_outlets' */}
                        {isManageOutlets && isChecked && (
                            <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-1 animate-fade-in">
                                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Pilih Outlet yang Diizinkan:</p>
                                {availableOutlets.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {availableOutlets.map(outlet => {
                                            const isSelected = watchedPermissions.allowed_outlet_ids?.includes(outlet.id);
                                            return (
                                                <div 
                                                    key={outlet.id}
                                                    onClick={() => handleToggleOutletId(outlet.id)}
                                                    className={`
                                                        flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-xs
                                                        ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}
                                                    `}
                                                >
                                                    {isSelected 
                                                        ? <CheckSquare size={14} className="text-blue-600" /> 
                                                        : <Square size={14} className="text-gray-400" />
                                                    }
                                                    <span className="font-medium">{outlet.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-gray-400 italic">Tidak ada outlet lain yang tersedia.</p>
                                )}
                            </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
        <Button 
          type="button" 
          variant="secondary" 
          onClick={onCancel}
          disabled={isSubmitting}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          Batal
        </Button>
        <Button 
          type="submit" 
          variant="primary" 
          disabled={isSubmitting}
          className="shadow-lg shadow-navbar-accent-1/20 min-w-[140px]"
        >
          {isSubmitting ? <Spinner size="sm" /> : (isEditMode ? 'Simpan Perubahan' : 'Buat Outlet')}
        </Button>
      </div>
    </form>
  );
};

export default AddOutletForm;
