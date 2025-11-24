import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Supplier } from '../../types/database';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  onSuccess: () => void;
  supplier?: Supplier | null;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ onSuccess, supplier }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  });

  useEffect(() => {
    if (supplier) {
      reset(supplier);
    } else {
      reset({ name: '', contact_person: '', phone: '', email: '', notes: '' });
    }
  }, [supplier, reset]);

  const onSubmit = async (data: SupplierFormData) => {
    try {
      let error;
      if (supplier) {
        ({ error } = await supabase.from('suppliers').update(data).eq('id', supplier.id));
      } else {
        ({ error } = await supabase.from('suppliers').insert(data));
      }

      if (error) throw error;

      toast.success(`Supplier successfully ${supplier ? 'updated' : 'created'}.`);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  
  const inputClass = "mt-1 block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 sm:text-sm transition-all duration-200";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-gray-700">Supplier Name</label>
        <input id="name" {...register('name')} className={inputClass} placeholder="Company Name" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label htmlFor="contact_person" className="block text-sm font-semibold text-gray-700">Contact Person</label>
        <input id="contact_person" {...register('contact_person')} className={inputClass} placeholder="John Doe" />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold text-gray-700">Phone</label>
        <input id="phone" {...register('phone')} className={inputClass} placeholder="+62..." />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-700">Email</label>
        <input id="email" type="email" {...register('email')} className={inputClass} placeholder="email@company.com" />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold text-gray-700">Notes</label>
        <textarea id="notes" {...register('notes')} rows={3} className={inputClass} placeholder="Additional notes..." />
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
        <Button type="submit" disabled={isSubmitting} variant="primary" className="w-full sm:w-auto shadow-lg shadow-navbar-accent-1/20">
          {isSubmitting ? <Spinner /> : 'Save Supplier'}
        </Button>
      </div>
    </form>
  );
};

export default SupplierForm;
