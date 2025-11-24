import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { User, Lock, Save, Key } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Password konfirmasi tidak cocok",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;

const UserProfileForm: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.full_name || '',
      password: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const updates: any = {};
      let profileUpdated = false;
      let passwordUpdated = false;

      // 1. Update Profile (Full Name)
      if (data.fullName !== user.full_name) {
        const { error } = await supabase
          .from('users')
          .update({ full_name: data.fullName })
          .eq('id', user.id);
        
        if (error) throw error;
        profileUpdated = true;
      }

      // 2. Update Password (if provided)
      if (data.password) {
        const { error } = await supabase.auth.updateUser({
          password: data.password
        });
        
        if (error) throw error;
        passwordUpdated = true;
      }

      if (profileUpdated || passwordUpdated) {
        toast.success('Profil berhasil diperbarui!');
        if (profileUpdated) {
            await refreshProfile();
        }
        // Reset password fields
        reset({ fullName: data.fullName, password: '', confirmPassword: '' });
      } else {
        toast.info('Tidak ada perubahan yang disimpan.');
      }

    } catch (error: any) {
      console.error(error);
      toast.error(`Gagal memperbarui profil: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all shadow-sm";
  const errorClass = "text-red-500 text-xs mt-1 ml-1";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <User className="w-5 h-5 mr-2 text-navbar-accent-1" />
            Profil Pengguna
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Kelola informasi akun dan keamanan Anda.
          </p>
        </div>

        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Email (Read Only) */}
            <div>
              <label className={labelClass}>Email (Tidak dapat diubah)</label>
              <div className="relative opacity-70">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  value={user?.email || ''}
                  disabled
                  className={`${inputClass} bg-gray-100 cursor-not-allowed`}
                />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className={labelClass}>Nama Lengkap</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('fullName')}
                  placeholder="Nama Lengkap Anda"
                  className={inputClass}
                />
              </div>
              {errors.fullName && <p className={errorClass}>{errors.fullName.message}</p>}
            </div>

            <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
                    <Lock className="w-4 h-4 mr-2 text-gray-400" />
                    Ganti Password
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* New Password */}
                    <div>
                        <label className={labelClass}>Password Baru</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                            type="password"
                            {...register('password')}
                            placeholder="Minimal 6 karakter"
                            className={inputClass}
                            />
                        </div>
                        {errors.password && <p className={errorClass}>{errors.password.message}</p>}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className={labelClass}>Konfirmasi Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                            type="password"
                            {...register('confirmPassword')}
                            placeholder="Ulangi password baru"
                            className={inputClass}
                            />
                        </div>
                        {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword.message}</p>}
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 flex justify-end">
              <Button 
                type="submit" 
                disabled={isSaving}
                className="w-full sm:w-auto shadow-lg shadow-navbar-accent-1/20 flex items-center justify-center"
              >
                {isSaving ? <Spinner size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Simpan Profil</>}
              </Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default UserProfileForm;
