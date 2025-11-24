import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, FileText, FileSpreadsheet, File } from 'lucide-react';
import { toast } from 'sonner';

interface RawImageUploadProps {
  onImageSelected: (file: File | null) => void;
  initialPreview?: string;
  className?: string;
  maxSizeMB?: number;
  compact?: boolean;
  allowDocuments?: boolean;
  label?: string;
  onClickOverride?: () => void; // New prop to override click behavior
}

const RawImageUpload: React.FC<RawImageUploadProps> = ({ 
  onImageSelected, 
  initialPreview, 
  className = '',
  maxSizeMB = 5,
  compact = false,
  allowDocuments = false,
  label,
  onClickOverride
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(initialPreview || null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    // Define allowed types
    const imageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const docTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ];

    const validTypes = allowDocuments ? [...imageTypes, ...docTypes] : imageTypes;

    // Check mime type or extension as fallback
    const isValidType = validTypes.includes(file.type) || validTypes.some(t => file.name.toLowerCase().endsWith(t.split('/').pop() || ''));

    if (!isValidType) {
      toast.error(`Format file tidak didukung. ${allowDocuments ? 'Gunakan JPG, PNG, PDF, Excel, atau Word.' : 'Gunakan JPG atau PNG.'}`);
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Ukuran file terlalu besar. Maksimal ${maxSizeMB}MB.`);
      return;
    }

    // Set metadata
    setFileType(file.type);
    setFileName(file.name);

    // Create preview URL
    if (imageTypes.includes(file.type)) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    } else {
      setPreview(null); // No image preview for docs
    }
    
    // Pass the raw file to parent
    onImageSelected(file);
    // Toast is handled by parent usually, but we can keep generic success here or remove it if parent handles it
    // toast.success(`${allowDocuments && !imageTypes.includes(file.type) ? 'Dokumen' : 'Gambar'} berhasil dipilih!`);
  }, [maxSizeMB, onImageSelected, allowDocuments]);

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
    if (preview) {
      URL.revokeObjectURL(preview); // Clean up memory
    }
    setPreview(null);
    setFileType(null);
    setFileName(null);
    onImageSelected(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const triggerInput = () => {
    if (onClickOverride) {
      onClickOverride();
    } else {
      inputRef.current?.click();
    }
  };

  // Helper to render document icon based on type
  const renderDocIcon = () => {
    if (!fileType && !fileName) return <File className="w-8 h-8 text-gray-400" />;
    
    if (fileType?.includes('pdf') || fileName?.endsWith('.pdf')) {
      return <FileText className="w-10 h-10 text-red-500" />;
    }
    if (fileType?.includes('sheet') || fileType?.includes('excel') || fileName?.endsWith('xls') || fileName?.endsWith('xlsx') || fileName?.endsWith('csv')) {
      return <FileSpreadsheet className="w-10 h-10 text-green-600" />;
    }
    return <FileText className="w-10 h-10 text-blue-500" />;
  };

  // Compact Mode UI
  if (compact) {
      return (
        <div className={`w-full ${className}`}>
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={allowDocuments ? "image/png, image/jpeg, image/webp, application/pdf, .xlsx, .xls, .csv, .doc, .docx" : "image/png, image/jpeg"}
                onChange={handleChange}
            />
            <div 
                onClick={triggerInput}
                className={`
                    relative w-full h-full min-h-[42px] flex items-center justify-center border border-dashed rounded-lg cursor-pointer transition-all
                    ${(preview || fileName) ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
                `}
            >
                {(preview || fileName) ? (
                    <div className="relative w-full h-full flex items-center px-3 py-1">
                        {preview ? (
                          <img src={preview} alt="Preview" className="h-8 w-8 object-cover rounded mr-2" />
                        ) : (
                          <div className="mr-2 transform scale-75">{renderDocIcon()}</div>
                        )}
                        <span className="text-xs text-gray-600 truncate flex-1 font-medium">
                          {fileName || 'File Selected'}
                        </span>
                        <button onClick={handleRemove} className="text-gray-400 hover:text-red-500 p-1"><X size={14} /></button>
                    </div>
                ) : (
                    <div className="flex items-center text-gray-500 text-xs">
                        {allowDocuments ? <Upload size={16} className="mr-2" /> : <ImageIcon size={16} className="mr-2" />}
                        <span>{label || (allowDocuments ? 'Upload File' : 'Upload Foto')}</span>
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
          ${(preview || fileName) ? 'border-solid border-gray-200' : ''}
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
          accept={allowDocuments ? "image/png, image/jpeg, image/webp, application/pdf, .xlsx, .xls, .csv, .doc, .docx" : "image/png, image/jpeg"}
          onChange={handleChange}
        />

        {(preview || fileName) ? (
          <div className="relative w-full h-full min-h-[200px] group-hover:opacity-95 transition-opacity bg-gray-50 flex flex-col items-center justify-center p-4">
            
            {preview ? (
              <img 
                src={preview} 
                alt="Preview" 
                className="max-h-[160px] w-auto object-contain rounded-lg shadow-sm mb-2" 
              />
            ) : (
              <div className="flex flex-col items-center justify-center mb-2">
                <div className="p-4 bg-white rounded-2xl shadow-sm mb-3">
                  {renderDocIcon()}
                </div>
                <p className="text-sm font-bold text-gray-700 max-w-[200px] truncate text-center">{fileName}</p>
                <p className="text-xs text-gray-500 uppercase mt-1">{fileType?.split('/')[1] || 'Document'}</p>
              </div>
            )}
            
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
              <p className="text-white text-sm font-medium flex items-center">
                <Upload className="w-4 h-4 mr-2" /> Ganti File
              </p>
            </div>
            
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all z-10"
              title="Hapus file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center p-6 transition-transform duration-300 group-hover:-translate-y-1">
            <div className={`
              w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors
              ${dragActive ? 'bg-navbar-accent-1 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-amber-50 group-hover:text-navbar-accent-1'}
            `}>
              {allowDocuments ? <FileText className="w-7 h-7" /> : <ImageIcon className="w-7 h-7" />}
            </div>
            <p className="text-sm font-semibold text-gray-700 group-hover:text-navbar-accent-1">
              {label || (allowDocuments ? 'Klik atau drag file ke sini' : 'Klik atau drag gambar ke sini')}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {allowDocuments ? 'JPG, PNG, PDF, Excel (Max 5MB)' : 'JPG, PNG (Max 5MB) - Original Quality'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RawImageUpload;
