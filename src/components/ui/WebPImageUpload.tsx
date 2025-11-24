import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, FileCheck } from 'lucide-react';
import { toast } from 'sonner';

interface WebPImageUploadProps {
  onImageProcessed: (file: File | null) => void;
  initialPreview?: string;
  className?: string;
  maxSizeMB?: number;
  quality?: number; // 0 to 1
  compact?: boolean;
  label?: string;
  subLabel?: string;
}

const WebPImageUpload: React.FC<WebPImageUploadProps> = ({ 
  onImageProcessed, 
  initialPreview, 
  className = '',
  maxSizeMB = 5,
  quality = 0.8,
  compact = false,
  label = "Klik atau seret file ke sini untuk mengunggah",
  subLabel = `Format: PNG, JPG. Maks: ${maxSizeMB}MB`
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(initialPreview || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<{ originalSize: string; webpSize: string; reduction: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const convertToWebP = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                  type: 'image/webp',
                  lastModified: Date.now(),
                });
                resolve(webpFile);
              } else {
                reject(new Error('Canvas to Blob conversion failed'));
              }
            },
            'image/webp',
            quality
          );
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFile = useCallback(async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.');
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB.`);
      return;
    }

    setIsProcessing(true);
    setStats(null);

    try {
      const webpFile = await convertToWebP(file);
      
      // Calculate stats
      const reduction = ((file.size - webpFile.size) / file.size) * 100;
      setStats({
        originalSize: formatSize(file.size),
        webpSize: formatSize(webpFile.size),
        reduction: reduction > 0 ? `${reduction.toFixed(1)}%` : '0%'
      });

      const objectUrl = URL.createObjectURL(webpFile);
      setPreview(objectUrl);
      onImageProcessed(webpFile);
      toast.success('Gambar berhasil diunggah!');
    } catch (error) {
      console.error("Conversion error:", error);
      toast.error("Gagal memproses gambar.");
    } finally {
      setIsProcessing(false);
    }
  }, [maxSizeMB, onImageProcessed, quality]);

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
    setStats(null);
    onImageProcessed(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const triggerInput = () => {
    inputRef.current?.click();
  };

  // Compact Mode UI (for small forms)
  if (compact) {
      return (
        <div className={`w-full ${className}`}>
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleChange}
            />
            <div 
                onClick={triggerInput}
                className={`
                    relative w-full h-full min-h-[42px] flex items-center justify-center border border-dashed rounded-lg cursor-pointer transition-all
                    ${preview ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
                `}
            >
                {preview ? (
                    <div className="relative w-full h-full flex items-center px-3">
                        <img src={preview} alt="Preview" className="h-8 w-8 object-cover rounded mr-2" />
                        <span className="text-xs text-gray-600 truncate flex-1">Image Selected</span>
                        <button onClick={handleRemove} className="text-gray-400 hover:text-red-500 p-1"><X size={14} /></button>
                    </div>
                ) : (
                    <div className="flex items-center text-gray-500 text-xs">
                        <ImageIcon size={16} className="mr-2" />
                        <span>{label}</span>
                    </div>
                )}
            </div>
        </div>
      );
  }

  // Standard Large UI
  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          relative w-full rounded-xl border-2 border-dashed transition-all duration-300 ease-in-out
          flex flex-col items-center justify-center overflow-hidden group cursor-pointer
          ${dragActive 
            ? 'border-navbar-accent-1 bg-amber-50/30 scale-[1.01]' 
            : 'border-gray-300 hover:border-navbar-accent-2 hover:bg-gray-50'
          }
          ${preview ? 'border-solid border-gray-200' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
        style={{ minHeight: '200px' }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleChange}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center h-full text-navbar-accent-1 animate-pulse p-6">
            <Loader2 className="w-10 h-10 animate-spin mb-3" />
            <p className="text-sm font-medium">Mengoptimalkan gambar...</p>
            <p className="text-xs text-gray-400 mt-1">Harap tunggu sebentar</p>
          </div>
        ) : preview ? (
          <div className="relative w-full h-full min-h-[200px] group-hover:opacity-95 transition-opacity bg-gray-50 flex items-center justify-center">
            <img 
              src={preview} 
              alt="Preview" 
              className="max-h-[180px] w-auto object-contain rounded-lg shadow-sm" 
            />
            
            {/* Stats Overlay */}
            {stats && (
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-2 shadow-sm z-10">
                <span className="text-gray-300 line-through">{stats.originalSize}</span>
                <span className="text-green-400 font-bold">{stats.webpSize}</span>
                <span className="bg-green-500/20 text-green-300 px-1 rounded">-{stats.reduction}</span>
              </div>
            )}

            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
              <p className="text-white text-sm font-medium flex items-center bg-black/50 px-3 py-1.5 rounded-full">
                <Upload className="w-4 h-4 mr-2" /> Ganti Gambar
              </p>
            </div>
            
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all z-30"
              title="Hapus gambar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center h-full w-full transition-transform duration-300 group-hover:-translate-y-1">
            <div className={`
              w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors
              ${dragActive ? 'bg-navbar-accent-1 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-amber-50 group-hover:text-navbar-accent-1'}
            `}>
              <ImageIcon className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-gray-700 group-hover:text-navbar-accent-1 px-4">
              {label}
            </p>
            <p className="text-xs text-gray-400 mt-1.5">
              {subLabel}
            </p>
          </div>
        )}
      </div>
      
      {/* Helper text */}
      {!preview && !isProcessing && (
        <div className="mt-2 flex items-start justify-center gap-2 text-xs text-gray-400 px-1 text-center">
          <FileCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-green-500" />
          <p>Gambar akan otomatis dikompresi (WebP) untuk performa optimal.</p>
        </div>
      )}
    </div>
  );
};

export default WebPImageUpload;
