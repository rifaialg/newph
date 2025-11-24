import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { Trash2, RefreshCw, AlertCircle } from 'lucide-react';

const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  description: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface Category {
  id: number;
  name: string;
  description?: string;
}

interface CategoryFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

const CategoryForm: React.FC<CategoryFormProps> = ({ onSuccess, onCancel }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  });

  const fetchCategories = async () => {
    setIsLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('item_categories')
        .select('id, name, description')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      toast.error('Gagal memuat daftar kategori.');
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const onSubmit = async (data: CategoryFormData) => {
    try {
      const { error } = await supabase.from('item_categories').insert([
        {
          name: data.name,
          description: data.description,
        }
      ]);

      if (error) throw error;

      toast.success('Kategori berhasil ditambahkan!');
      reset();
      fetchCategories(); // Refresh list
      onSuccess(); // Optional: close modal or just refresh parent
    } catch (error: any) {
      console.error('Error adding category:', error);
      toast.error(`Gagal menambahkan kategori: ${error.message}`);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus kategori "${name}"?`)) {
      try {
        const { error } = await supabase.from('item_categories').delete().eq('id', id);
        
        if (error) {
          // PostgreSQL Error Code 23503: foreign_key_violation
          if (error.code === '23503') {
            toast.custom((t) => (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 shadow-lg max-w-md">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-red-800">Penghapusan Ditolak</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Kategori <strong>"{name}"</strong> sedang digunakan oleh satu atau lebih produk.
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    Solusi: Hapus produk terkait atau pindahkan ke kategori lain terlebih dahulu.
                  </p>
                </div>
                <button onClick={() => toast.dismiss(t)} className="ml-auto text-red-400 hover:text-red-600">
                  ✕
                </button>
              </div>
            ), { duration: 6000 });
            return; // Stop execution here
          }
          
          // Other errors
          throw error;
        }
        
        toast.success(`Kategori "${name}" berhasil dihapus.`);
        fetchCategories();
      } catch (error: any) {
        console.error('Error deleting category:', error);
        toast.error(`Gagal menghapus kategori: ${error.message}`);
      }
    }
  };

  const inputClass = "mt-1 block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 sm:text-sm transition-all duration-200";

  return (
    <div className="space-y-8">
      {/* Form Section */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-gray-700">
            Nama Kategori Baru
          </label>
          <input
            id="name"
            type="text"
            {...register('name')}
            className={inputClass}
            placeholder="Contoh: Minuman, Makanan Ringan"
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-gray-700">
            Deskripsi (Opsional)
          </label>
          <textarea
            id="description"
            rows={2}
            {...register('description')}
            className={inputClass}
            placeholder="Deskripsi singkat kategori..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            variant="primary"
            className="shadow-lg shadow-navbar-accent-1/20 w-full sm:w-auto"
          >
            {isSubmitting ? <Spinner size="sm" /> : 'Simpan Kategori'}
          </Button>
        </div>
      </form>

      {/* List Section */}
      <div className="border-t border-gray-100 pt-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Daftar Kategori</h4>
          <button 
            onClick={fetchCategories} 
            className="text-gray-400 hover:text-navbar-accent-1 transition-colors p-1 rounded-full hover:bg-gray-50"
            title="Refresh List"
          >
            <RefreshCw size={14} className={isLoadingList ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
          {isLoadingList ? (
            <div className="p-6 flex justify-center">
              <Spinner size="md" color="primary" />
            </div>
          ) : categories.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {categories.map((cat) => (
                <li key={cat.id} className="px-4 py-3 flex justify-between items-center hover:bg-white transition-colors group">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{cat.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Hapus Kategori"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              Belum ada kategori yang terdaftar.
            </div>
          )}
        </div>
      </div>
      
      {onCancel && (
        <div className="flex justify-end pt-4 border-t border-gray-100">
           <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
          >
            Tutup
          </Button>
        </div>
      )}
    </div>
  );
};

export default CategoryForm;
