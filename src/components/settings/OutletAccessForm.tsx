import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Outlet, OutletPermissions } from '../../types/database';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { 
  Shield, Key, Eye, EyeOff, CheckCircle, XCircle, 
  LayoutDashboard, ShoppingBag, ArrowDownCircle, ArrowUpCircle, 
  ClipboardList, Calculator, BarChart, Lock, Store, CheckSquare, Square
} from 'lucide-react';

// --- Schema Validasi ---
const accessSchema = z.object({
  username: z.string().min(4, 'Username minimal 4 karakter').regex(/^[a-zA-Z0-9_]+$/, 'Hanya huruf, angka, dan underscore'),
  password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
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

type AccessFormData = z.infer<typeof accessSchema>;

interface OutletAccessFormProps {
  outlet: Outlet;
  onSuccess: () => void;
  onCancel: () => void;
}

// --- Konfigurasi Modul Akses ---
const ACCESS_MODULES: { key: keyof OutletPermissions; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Akses ringkasan metrik utama' },
  { key: 'inventory_items', label: 'Produk (Katalog)', icon: ShoppingBag, desc: 'Melihat daftar produk master' },
  { key: 'incoming_stock', label: 'Barang Masuk', icon: ArrowDownCircle, desc: 'Input stok masuk / pembelian' },
  { key: 'outgoing_stock', label: 'Distribusi (Keluar)', icon: ArrowUpCircle, desc: 'Input barang keluar / wastage' },
  { key: 'opname', label: 'Stok Opname', icon: ClipboardList, desc: 'Akses sesi opname dan penyesuaian' },
  { key: 'calculator', label: 'Kalkulator HPP', icon: Calculator, desc: 'Akses fitur hitung HPP' },
  { key: 'reports', label: 'Laporan', icon: BarChart, desc: 'Melihat laporan analitik' },
  { key: 'manage_outlets', label: 'Manajemen Outlet', icon: Store, desc: 'Akses data outlet lain' },
];

const OutletAccessForm: React.FC<OutletAccessFormProps> = ({ outlet, onSuccess, onCancel }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableOutlets, setAvailableOutlets] = useState<Outlet[]>([]);

  // Default Permissions
  const defaultPermissions: OutletPermissions = {
    dashboard: true,
    inventory_items: true,
    incoming_stock: true,
    outgoing_stock: true,
    opname: true,
    calculator: false, 
    reports: false,
    manage_outlets: false,
    allowed_outlet_ids: []
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<AccessFormData>({
    resolver: zodResolver(accessSchema),
    defaultValues: {
      username: outlet.login_username || '',
      password: '',
      permissions: outlet.permissions || defaultPermissions
    }
  });

  const watchedPermissions = watch('permissions');

  // Fetch existing outlets for the multi-select
  useEffect(() => {
    const fetchOutlets = async () => {
      const { data } = await supabase.from('outlets').select('id, name').eq('is_active', true).neq('id', outlet.id); // Exclude self
      setAvailableOutlets(data || []);
    };
    fetchOutlets();
  }, [outlet.id]);

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

  const onSubmit = async (data: AccessFormData) => {
    setIsSubmitting(true);
    try {
      // 1. Update Outlet Record (Permissions & Username)
      const updatePayload: any = {
        login_username: data.username,
        permissions: data.permissions
      };
      
      const { error } = await supabase
        .from('outlets')
        .update(updatePayload)
        .eq('id', outlet.id);

      if (error) throw error;

      // Simulate Auth Update (Placeholder for Edge Function call)
      if (data.password) {
        console.log("Password update requested for", data.username);
      }

      toast.success(`Akses outlet "${outlet.name}" berhasil diperbarui!`);
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(`Gagal menyimpan: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      
      {/* --- Section 1: Credentials --- */}
      <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
        <div className="flex items-center mb-4 text-blue-800">
          <div className="p-2 bg-blue-100 rounded-lg mr-3">
            <Key size={18} />
          </div>
          <div>
            <h4 className="font-bold text-sm">Kredensial Login</h4>
            <p className="text-xs text-blue-600">Akun ini terhubung dengan Super Admin.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Username</label>
            <input
              {...register('username')}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 outline-none"
              placeholder="outlet_joglo"
            />
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Password Baru</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                {...register('password')}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 outline-none pr-10"
                placeholder="Kosongkan jika tidak ubah"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
        </div>
      </div>

      {/* --- Section 2: RBAC Permissions --- */}
      <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
        <div className="flex items-center mb-4 text-gray-800">
          <div className="p-2 bg-white border border-gray-200 rounded-lg mr-3 shadow-sm">
            <Shield size={18} className="text-navbar-accent-1" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Hak Akses Menu (RBAC)</h4>
            <p className="text-xs text-gray-500">Pilih menu yang diizinkan untuk outlet ini.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
          {ACCESS_MODULES.map((module) => {
            const isChecked = watchedPermissions[module.key];
            const Icon = module.icon;
            const isManageOutlets = module.key === 'manage_outlets';
            
            return (
              <div key={module.key} className="space-y-2">
                <div 
                    onClick={() => handleTogglePermission(module.key)}
                    className={`
                    flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200
                    ${isChecked 
                        ? 'bg-white border-green-200 shadow-sm' 
                        : 'bg-gray-100 border-transparent opacity-70 hover:opacity-100'
                    }
                    `}
                >
                    <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isChecked ? 'bg-green-50 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                        <Icon size={16} />
                    </div>
                    <div>
                        <p className={`text-sm font-bold ${isChecked ? 'text-gray-900' : 'text-gray-500'}`}>
                        {module.label}
                        </p>
                        <p className="text-[10px] text-gray-400">{module.desc}</p>
                    </div>
                    </div>

                    <div className={`
                    w-10 h-5 rounded-full flex items-center transition-colors duration-300 px-1
                    ${isChecked ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'}
                    `}>
                    <div className="w-3 h-3 bg-white rounded-full shadow-md" />
                    </div>
                </div>

                {/* Conditional Outlet Selection for 'manage_outlets' */}
                {isManageOutlets && isChecked && (
                    <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-1 animate-fade-in">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Pilih Outlet yang Diizinkan:</p>
                        {availableOutlets.length > 0 ? (
                            <div className="grid grid-cols-1 gap-1.5">
                                {availableOutlets.map(o => {
                                    const isSelected = watchedPermissions.allowed_outlet_ids?.includes(o.id);
                                    return (
                                        <div 
                                            key={o.id}
                                            onClick={() => handleToggleOutletId(o.id)}
                                            className={`
                                                flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-xs
                                                ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-600'}
                                            `}
                                        >
                                            {isSelected 
                                                ? <CheckSquare size={14} className="text-blue-600" /> 
                                                : <Square size={14} className="text-gray-400" />
                                            }
                                            <span className="font-medium">{o.name}</span>
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

      {/* --- Actions --- */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
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
          {isSubmitting ? <Spinner size="sm" /> : 'Simpan Akses'}
        </Button>
      </div>
    </form>
  );
};

export default OutletAccessForm;
