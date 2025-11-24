import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import WebPImageUpload from '../ui/WebPImageUpload';
import { Building, Mail, Phone, MapPin, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Schema Validasi
const companyProfileSchema = z.object({
  companyName: z.string().min(2, 'Nama perusahaan minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit').regex(/^\d+$/, 'Hanya angka yang diperbolehkan'),
  address: z.string().min(5, 'Alamat wajib diisi'),
});

type CompanyProfileFormData = z.infer<typeof companyProfileSchema>;

const CompanyProfileForm: React.FC = () => {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CompanyProfileFormData>({
    resolver: zodResolver(companyProfileSchema),
  });

  // Load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('company_profile');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setValue('companyName', parsed.companyName);
        setValue('email', parsed.email);
        setValue('phone', parsed.phone);
        setValue('address', parsed.address);
        if (parsed.logoUrl) {
          setLogoPreview(parsed.logoUrl);
        }
      } catch (e) {
        console.error("Error parsing profile data", e);
      }
    }
  }, [setValue]);

  const handleLogoProcessed = (file: File | null) => {
    setLogoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  const uploadLogo = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${fileExt}`;
      const filePath = `company/${fileName}`;

      // Upload to 'product-images' bucket (reusing existing bucket for simplicity)
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
        });

      if (uploadError) {
        // Check specifically for bucket not found to give better feedback
        if (uploadError.message.includes('Bucket not found') || (uploadError as any).statusCode === '404') {
            throw new Error("Storage bucket belum siap. Harap jalankan migrasi database.");
        }
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      console.error("Logo upload failed:", error);
      toast.error(`Gagal mengupload logo: ${error.message}`);
      return null;
    }
  };

  const onSubmit = async (data: CompanyProfileFormData) => {
    setIsSaving(true);
    try {
      let finalLogoUrl = logoPreview;

      // Upload logo if a new file is selected
      if (logoFile) {
        const uploadedUrl = await uploadLogo(logoFile);
        if (uploadedUrl) {
            finalLogoUrl = uploadedUrl;
        } else {
            // If upload fails, stop saving process to let user retry
            setIsSaving(false);
            return; 
        }
      }

      const profileData = {
        ...data,
        logoUrl: finalLogoUrl 
      };

      // Save to localStorage (simulating DB for company profile settings)
      localStorage.setItem('company_profile', JSON.stringify(profileData));
      
      toast.success('Profil perusahaan berhasil diperbarui!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all shadow-sm";
  const errorClass = "text-red-500 text-xs mt-1 ml-1";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Building className="w-5 h-5 mr-2 text-navbar-accent-1" />
            Informasi Perusahaan
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Detail ini akan ditampilkan pada invoice dan laporan resmi.
          </p>
        </div>

        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Left Column: Logo Upload */}
            <div className="md:col-span-1 flex flex-col items-center md:items-start space-y-4">
              <label className={labelClass}>Logo Perusahaan</label>
              <div className="w-full max-w-[240px] mx-auto md:mx-0">
                <WebPImageUpload 
                  onImageProcessed={handleLogoProcessed}
                  initialPreview={logoPreview}
                  className="h-full w-full"
                  maxSizeMB={2}
                  label="Klik atau seret file ke sini"
                  subLabel="Format: PNG, JPG. Maks: 2MB"
                />
              </div>
              <p className="text-xs text-gray-500 text-center md:text-left">
                Logo akan muncul di header Invoice dan Surat Jalan.
              </p>
            </div>

            {/* Right Column: Details Form */}
            <div className="md:col-span-2 space-y-5">
              
              {/* Company Name */}
              <div>
                <label className={labelClass}>Nama Perusahaan</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('companyName')}
                    placeholder="PT Artirasa Cipta Sentosa"
                    className={inputClass}
                  />
                </div>
                {errors.companyName && <p className={errorClass}>{errors.companyName.message}</p>}
              </div>

              {/* Email & Phone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Email Resmi</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      {...register('email')}
                      placeholder="finance@artirasa.co.id"
                      className={inputClass}
                    />
                  </div>
                  {errors.email && <p className={errorClass}>{errors.email.message}</p>}
                </div>

                <div>
                  <label className={labelClass}>Nomor Telepon</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      {...register('phone')}
                      placeholder="021-7890123"
                      className={inputClass}
                    />
                  </div>
                  {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className={labelClass}>Alamat Lengkap</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    {...register('address')}
                    rows={3}
                    placeholder="Jl. Kemang Raya No. 123, Jakarta Selatan"
                    className={`${inputClass} pl-10 resize-none`}
                  />
                </div>
                {errors.address && <p className={errorClass}>{errors.address.message}</p>}
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-end">
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full sm:w-auto shadow-lg shadow-navbar-accent-1/20 flex items-center justify-center"
                >
                  {isSaving ? <Spinner size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Simpan Perubahan</>}
                </Button>
              </div>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfileForm;
