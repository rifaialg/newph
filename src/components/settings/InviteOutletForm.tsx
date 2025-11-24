import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { Store, User, Mail, Phone } from 'lucide-react';

// Schema Validasi dengan Zod
const inviteOutletSchema = z.object({
  outletName: z.string().min(3, 'Outlet name must be at least 3 characters'),
  picName: z.string().min(2, 'PIC name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').regex(/^\d+$/, 'Phone number must contain only digits'),
});

type InviteOutletFormData = z.infer<typeof inviteOutletSchema>;

interface InviteOutletFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const InviteOutletForm: React.FC<InviteOutletFormProps> = ({ onSuccess, onCancel }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<InviteOutletFormData>({
    resolver: zodResolver(inviteOutletSchema),
  });

  const onSubmit = async (data: InviteOutletFormData) => {
    try {
      // 1. Simpan data Outlet ke database
      const { data: outletData, error: outletError } = await supabase
        .from('outlets')
        .insert({
          name: data.outletName,
          manager_name: data.picName,
          email: data.email, // Now enabled since column exists
          phone: data.phone,
          is_active: true
        })
        .select()
        .single();

      if (outletError) throw outletError;

      // 2. Trigger Edge Function untuk Invite User (Role: Outlet)
      const { error: inviteError } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: data.email, 
          role: 'outlet',
          outlet_id: outletData.id // Menghubungkan user dengan outlet
        },
      });

      if (inviteError) {
        console.warn("Auto-invite failed (likely due to env limits), but outlet created.", inviteError);
        toast.success('Outlet created. Please invite the user manually via Settings if auto-invite failed.');
      } else {
        toast.success(`Invitation sent to ${data.email} for ${data.outletName}`);
      }

      reset();
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to process: ${error.message}`);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all shadow-sm";
  const errorClass = "text-red-500 text-xs mt-1 ml-1";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-4">
        {/* Outlet Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Outlet Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Store className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('outletName')}
              placeholder="e.g. Artirasa Cabang Pusat"
              className={inputClass}
            />
          </div>
          {errors.outletName && <p className={errorClass}>{errors.outletName.message}</p>}
        </div>

        {/* PIC Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">PIC Name</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('picName')}
              placeholder="e.g. Budi Santoso"
              className={inputClass}
            />
          </div>
          {errors.picName && <p className={errorClass}>{errors.picName.message}</p>}
        </div>

        {/* PIC Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">PIC Email (For Login)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="email"
              {...register('email')}
              placeholder="pic@artirasa.co.id"
              className={inputClass}
            />
          </div>
          {errors.email && <p className={errorClass}>{errors.email.message}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="tel"
              {...register('phone')}
              placeholder="081234567890"
              className={inputClass}
            />
          </div>
          {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
        <Button 
          type="button" 
          variant="secondary" 
          onClick={onCancel}
          disabled={isSubmitting}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary" 
          disabled={isSubmitting}
          className="shadow-lg shadow-navbar-accent-1/20 min-w-[140px]"
        >
          {isSubmitting ? <Spinner size="sm" /> : 'Send Invitation'}
        </Button>
      </div>
    </form>
  );
};

export default InviteOutletForm;
