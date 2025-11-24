import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Item, Category } from '../../types/database';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import WebPImageUpload from '../ui/WebPImageUpload';
import { RefreshCw, Database } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const itemSchema = z.object({
  name: z.string().min(1, 'NAMA BARANG WAJIB DIISI'),
  sku: z.string().optional(),
  category_id: z.coerce.number().min(1, 'KATEGORI WAJIB DIPILIH'),
  unit: z.string().min(1, 'SATUAN WAJIB DIISI'),
  cost_price: z.coerce.number().min(0, 'HARGA BELI TIDAK BOLEH NEGATIF'),
  selling_price: z.coerce.number().min(0, 'HARGA JUAL TIDAK BOLEH NEGATIF').optional(),
  min_stock: z.coerce.number().min(0, 'MINIMUM STOCK TIDAK BOLEH NEGATIF').optional(),
  current_stock: z.coerce.number().min(0, 'STOK TIDAK BOLEH NEGATIF').default(0), // New Field
});

type ItemFormData = z.infer<typeof itemSchema>;

interface ItemFormProps {
  onSuccess: () => void;
  item?: Item | null;
}

const ItemForm: React.FC<ItemFormProps> = ({ onSuccess, item }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(item?.image_url || undefined);
  const [initialStock, setInitialStock] = useState<number>(0);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
        min_stock: 10,
        cost_price: 0,
        selling_price: 0,
        current_stock: 0,
        unit: '' 
    }
  });

  const watchedName = watch('name');

  useEffect(() => {
    const fetchData = async () => {
      const { data: catData, error: catError } = await supabase.from('item_categories').select('id, name');
      if (catError) toast.error('Failed to load categories');
      else setCategories(catData);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (item) {
      // Cast item to any to access current_stock if it exists (passed from SessionsPage)
      const stockValue = (item as any).current_stock || 0;
      setInitialStock(stockValue);

      reset({
        name: item.name,
        sku: item.sku || '',
        category_id: item.category_id,
        unit: item.unit,
        cost_price: item.cost_price,
        selling_price: item.selling_price || 0,
        min_stock: item.min_stock,
        current_stock: stockValue, // Pre-fill current stock
      });
      setPreviewUrl(item.image_url || undefined);
    }
  }, [item, reset]);

  const generateSmartSku = () => {
    const prefix = 'AR';
    let namePart = 'XXXX';
    
    if (watchedName) {
        const cleanName = watchedName.trim().toUpperCase();
        const words = cleanName.split(/\s+/);

        if (words.length >= 2) {
            const firstLetter = words[0].charAt(0);
            const secondWordPart = words[1].substring(0, 3).padEnd(3, 'X');
            namePart = firstLetter + secondWordPart;
        } else if (words.length === 1) {
            namePart = words[0].substring(0, 4).padEnd(4, 'X');
        }
    }

    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const smartSku = `${prefix}-${namePart}-${randomNum}`;
    
    setValue('sku', smartSku);
  };

  const handleImageProcessed = (file: File | null) => {
      setImageFile(file);
  };

  const onSubmit = async (data: ItemFormData) => {
    try {
      let imageUrl = item?.image_url;

      // 1. Upload Image
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, imageFile);

        if (uploadError) {
             if (uploadError.message.includes("Bucket not found") || (uploadError as any).statusCode === '404') {
                 toast.warning(`Storage bucket belum siap. Produk disimpan tanpa gambar baru.`);
            } else {
                 console.error("Image upload failed:", uploadError);
            }
        } else {
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);
            imageUrl = publicUrl;
        }
      }

      // 2. Generate SKU if empty
      let finalSku = data.sku;
      if (!finalSku) {
          const prefix = 'AR';
          let namePart = 'XXXX';
          const cleanName = data.name.trim().toUpperCase();
          const words = cleanName.split(/\s+/);
          if (words.length >= 2) {
              namePart = words[0].charAt(0) + words[1].substring(0, 3).padEnd(3, 'X');
          } else if (words.length === 1) {
              namePart = words[0].substring(0, 4).padEnd(4, 'X');
          }
          finalSku = `${prefix}-${namePart}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      }

      // 3. Save Item Data
      const submissionData = {
        name: data.name,
        sku: finalSku,
        category_id: data.category_id,
        unit: data.unit,
        cost_price: data.cost_price,
        selling_price: data.selling_price || 0,
        min_stock: data.min_stock || 0,
        image_url: imageUrl,
        is_active: true
      };

      let itemId = item?.id;
      let error;

      if (item) {
        ({ error } = await supabase.from('items').update(submissionData).eq('id', item.id));
      } else {
        const { data: newItem, error: createError } = await supabase.from('items').insert(submissionData).select('id').single();
        error = createError;
        itemId = newItem?.id;
      }

      if (error) throw error;

      // 4. Handle Stock Update (Movement)
      const newStock = data.current_stock;
      const stockDiff = newStock - initialStock;

      // Only create movement if stock has changed (for edit) or is non-zero (for new item)
      if (itemId && stockDiff !== 0) {
          // Get default location
          const { data: locations } = await supabase.from('locations').select('id').limit(1);
          const locationId = locations?.[0]?.id;

          if (locationId) {
              const movementType = item ? 'manual_adjustment' : 'initial_stock'; // Use initial_stock for new items if supported, else manual_adjustment
              const note = item 
                  ? `Stock correction via Master Data Edit (Prev: ${initialStock}, New: ${newStock})` 
                  : `Initial Stock Setup`;

              const { error: moveError } = await supabase.from('stock_movements').insert({
                  item_id: itemId,
                  location_id: locationId,
                  quantity_change: stockDiff,
                  movement_type: 'manual_adjustment',
                  note: note,
                  created_by: user?.id
              });

              if (moveError) {
                  console.error("Stock update failed:", moveError);
                  toast.warning("Data produk tersimpan, namun gagal mengupdate stok.");
              }
          }
      }

      toast.success(`Produk berhasil ${item ? 'diperbarui' : 'dibuat'}.`);
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    }
  };
  
  const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all shadow-sm text-sm";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      
      {/* Nama Barang */}
      <div>
        <label htmlFor="name" className={labelClass}>NAMA BARANG <span className="text-red-500">*</span></label>
        <input id="name" {...register('name')} className={inputClass} placeholder="Contoh: Kopi Susu Gula Aren" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      {/* SKU & Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="sku" className={labelClass}>SKU (OPTIONAL)</label>
            <div className="relative">
                <input id="sku" {...register('sku')} className={inputClass} placeholder="Auto-generated if empty" />
                <button 
                    type="button" 
                    onClick={generateSmartSku}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navbar-accent-1 p-1 transition-colors"
                    title="Generate Smart SKU"
                >
                    <RefreshCw size={16} />
                </button>
            </div>
        </div>
        <div>
            <label htmlFor="category_id" className={labelClass}>KATEGORI <span className="text-red-500">*</span></label>
            <div className="relative">
                <select id="category_id" {...register('category_id')} className={`${inputClass} appearance-none cursor-pointer`}>
                    <option value="">Pilih Kategori</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
            </div>
            {errors.category_id && <p className="text-red-500 text-xs mt-1">{errors.category_id.message}</p>}
        </div>
      </div>

      {/* Unit & Min Stock Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="unit" className={labelClass}>SATUAN <span className="text-red-500">*</span></label>
            <div className="relative">
                <select 
                    id="unit" 
                    {...register('unit')} 
                    className={`${inputClass} appearance-none cursor-pointer`}
                >
                    <option value="" disabled className="text-gray-400">Pilih Satuan</option>
                    {['Gr', 'Ltr', 'Kg', 'Dus', 'Box', 'Pcs', 'Btl'].map(u => (
                        <option key={u} value={u}>{u}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
            </div>
            {errors.unit && <p className="text-red-500 text-xs mt-1">{errors.unit.message}</p>}
        </div>
        <div>
            <label htmlFor="min_stock" className={labelClass}>MIN. STOCK</label>
            <input id="min_stock" type="number" {...register('min_stock')} className={`${inputClass} text-center`} />
        </div>
      </div>

      {/* Prices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="cost_price" className={`${labelClass} text-center`}>HARGA BELI SATUAN <span className="text-red-500">*</span></label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Rp</span>
                <input id="cost_price" type="number" {...register('cost_price')} className={`${inputClass} pl-8 text-center`} />
            </div>
            {errors.cost_price && <p className="text-red-500 text-xs mt-1 text-center">{errors.cost_price.message}</p>}
        </div>
        <div>
            <label htmlFor="selling_price" className={`${labelClass} text-center`}>HARGA JUAL SATUAN <span className="text-red-500">*</span></label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Rp</span>
                <input id="selling_price" type="number" {...register('selling_price')} className={`${inputClass} pl-8 text-center`} />
            </div>
        </div>
      </div>

      {/* NEW FIELD: Actual Stock */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
        <div className="flex items-center justify-between mb-2">
            <label htmlFor="current_stock" className="block text-xs font-bold text-blue-800 uppercase tracking-wide flex items-center">
                <Database className="w-3 h-3 mr-1.5" />
                STOK AKTUAL (LIVE)
            </label>
            {item && (
                <span className="text-[10px] bg-white px-2 py-0.5 rounded text-blue-600 border border-blue-200">
                    Awal: {initialStock}
                </span>
            )}
        </div>
        <div className="relative">
            <input 
                id="current_stock" 
                type="number" 
                {...register('current_stock')} 
                className={`${inputClass} text-center font-bold text-lg text-blue-700 border-blue-200 focus:ring-blue-500/20 focus:border-blue-500`} 
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-medium pointer-events-none">
                UNIT
            </div>
        </div>
        <p className="text-[10px] text-blue-600 mt-1.5 text-center">
            Mengubah nilai ini akan otomatis mencatat penyesuaian stok di sistem.
        </p>
      </div>

      {/* Image Upload */}
      <div>
        <label className={labelClass}>FOTO PRODUK</label>
        <div className="w-full">
            <WebPImageUpload 
                onImageProcessed={handleImageProcessed} 
                initialPreview={previewUrl}
                className="w-full"
                compact={true}
            />
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-gray-100">
        <Button type="submit" disabled={isSubmitting} variant="primary" className="w-full sm:w-auto shadow-lg shadow-navbar-accent-1/20 py-3 px-8">
          {isSubmitting ? <Spinner /> : (item ? 'Simpan Perubahan' : 'Simpan Produk Baru')}
        </Button>
      </div>
    </form>
  );
};

export default ItemForm;
