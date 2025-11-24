import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadProps {
  onImageSelected: (file: File | null) => void;
  initialPreview?: string;
  className?: string;
  maxSizeMB?: number;
  bottomContent?: React.ReactNode;
  compact?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onImageSelected, 
  initialPreview, 
  className = '',
  maxSizeMB = 5,
  bottomContent,
  compact = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(initialPreview || null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.');
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB.`);
      return;
    }

    setUploading(true);
    const objectUrl = URL.createObjectURL(file);
    
    // Simulate processing delay for better UX feel
    setTimeout(() => {
      setPreview(objectUrl);
      onImageSelected(file);
      setUploading(false);
      toast.success('Gambar berhasil dimuat!');
    }, 600);
  }, [maxSizeMB, onImageSelected]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onImageSelected(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const triggerInput = () => {
    inputRef.current?.click();
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          relative w-full rounded-xl border-2 border-dashed transition-all duration-300 ease-in-out
          flex flex-col items-center justify-center overflow-hidden group cursor-pointer
          ${dragActive 
            ? 'border-navbar-accent-1 bg-amber-50/30 scale-[1.01]' 
            : 'border-gray-300 hover:border-navbar-accent-1 hover:bg-gray-50'
          }
          ${preview ? 'border-solid border-gray-200 bg-white' : 'bg-gray-50'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
        style={{ minHeight: compact ? '100px' : '200px' }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleChange}
        />

        <div className="flex-1 flex flex-col items-center justify-center w-full p-4">
          {uploading ? (
            <div className="flex flex-col items-center text-navbar-accent-1">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs font-medium">Memproses...</p>
            </div>
          ) : preview ? (
            <div className="relative w-full h-full flex items-center justify-center group-hover:opacity-90 transition-opacity">
              <img 
                src={preview} 
                alt="Preview" 
                className="max-h-full max-w-full object-contain rounded-lg shadow-sm" 
                style={{ maxHeight: compact ? '80px' : '160px' }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                <p className="text-white text-xs font-medium flex items-center">
                  <Upload className="w-3 h-3 mr-1" /> Ganti
                </p>
              </div>
              <button
                onClick={handleRemove}
                className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-md text-gray-500 hover:text-red-500 transition-all z-10"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 transition-colors
                ${dragActive ? 'bg-navbar-accent-1 text-white' : 'bg-white text-gray-400 shadow-sm group-hover:text-navbar-accent-1'}
              `}>
                <ImageIcon className="w-5 h-5" />
              </div>
              {!compact && (
                <>
                  <p className="text-sm font-semibold text-gray-700 group-hover:text-navbar-accent-1 transition-colors">
                    Upload Foto
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    JPG, PNG, WEBP (Max 5MB)
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {bottomContent && (
          <div 
            className="w-full px-4 pb-4 pt-0 z-20" 
            onClick={(e) => e.stopPropagation()}
          >
            {bottomContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;
