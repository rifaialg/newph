import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, AlertCircle, CheckCircle, Download, X } from 'lucide-react';
import Button from '../ui/Button';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import Spinner from '../ui/Spinner';
import { exportToCsv } from '../../utils/export';

interface CsvItemRow {
  Name: string;
  SKU: string;
  Category: string;
  Unit: string;
  'Cost Price': string;
  'Min Stock': string;
}

interface ParsedItem {
  name: string;
  sku: string;
  category_name: string;
  unit: string;
  cost_price: number;
  min_stock: number;
  isValid: boolean;
  errors: string[];
}

interface CsvItemImporterProps {
  onSuccess: () => void;
  onClose: () => void;
}

const CsvItemImporter: React.FC<CsvItemImporterProps> = ({ onSuccess, onClose }) => {
  const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Name: 'Arabica Coffee Beans',
        SKU: 'COF-ARA-001',
        Category: 'Ingredients',
        Unit: 'kg',
        'Cost Price': '150000',
        'Min Stock': '5'
      }
    ];
    exportToCsv('item_import_template.csv', templateData);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      processFile(droppedFile);
    } else {
      toast.error('Please upload a valid CSV file.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFile(file);
    setParsing(true);
    setParsedData([]);

    Papa.parse<CsvItemRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const processed = results.data.map((row, index) => validateRow(row, index));
        setParsedData(processed);
        setParsing(false);
        
        if (processed.length === 0) {
          toast.error("The CSV file appears to be empty.");
        } else if (results.errors.length > 0) {
          toast.warning(`Completed with ${results.errors.length} parsing errors.`);
        } else {
          toast.success(`Successfully parsed ${processed.length} rows.`);
        }
      },
      error: (error) => {
        toast.error(`CSV Parsing Error: ${error.message}`);
        setParsing(false);
      }
    });
  };

  const validateRow = (row: CsvItemRow, index: number): ParsedItem => {
    const errors: string[] = [];
    
    if (!row.Name?.trim()) errors.push('Name is required');
    if (!row.Category?.trim()) errors.push('Category is required');
    if (!row.Unit?.trim()) errors.push('Unit is required');

    const costPrice = parseFloat(row['Cost Price']);
    if (isNaN(costPrice) || costPrice < 0) errors.push('Invalid Cost Price');

    const minStock = parseFloat(row['Min Stock']);
    if (isNaN(minStock) || minStock < 0) errors.push('Invalid Min Stock');

    return {
      name: row.Name?.trim() || '',
      sku: row.SKU?.trim() || '',
      category_name: row.Category?.trim() || '',
      unit: row.Unit?.trim() || '',
      cost_price: isNaN(costPrice) ? 0 : costPrice,
      min_stock: isNaN(minStock) ? 0 : minStock,
      isValid: errors.length === 0,
      errors
    };
  };

  const handleSubmit = async () => {
    const validItems = parsedData.filter(i => i.isValid);
    if (validItems.length === 0) {
      toast.error("No valid items to import.");
      return;
    }

    setUploading(true);
    try {
      const uniqueCategories = Array.from(new Set(validItems.map(i => i.category_name)));
      
      const { data: existingCats, error: catFetchError } = await supabase
        .from('item_categories')
        .select('id, name');
      
      if (catFetchError) throw catFetchError;

      const categoryMap = new Map<string, number>();
      existingCats?.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id));

      const newCategories = uniqueCategories.filter(name => !categoryMap.has(name.toLowerCase()));

      if (newCategories.length > 0) {
        const { data: createdCats, error: createCatError } = await supabase
          .from('item_categories')
          .insert(newCategories.map(name => ({ name })))
          .select('id, name');
        
        if (createCatError) throw createCatError;
        createdCats?.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id));
      }

      const itemsToInsert = validItems.map(item => ({
        name: item.name,
        sku: item.sku || null,
        category_id: categoryMap.get(item.category_name.toLowerCase()),
        unit: item.unit,
        cost_price: item.cost_price,
        min_stock: item.min_stock,
        is_active: true
      }));

      const { error: insertError } = await supabase
        .from('items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      toast.success(`Successfully imported ${itemsToInsert.length} items!`);
      onSuccess();
      onClose();

    } catch (error: any) {
      console.error(error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const validCount = parsedData.filter(i => i.isValid).length;
  const invalidCount = parsedData.length - validCount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
        <div>
          <h4 className="text-sm font-semibold text-blue-900">Need the format?</h4>
          <p className="text-xs text-blue-700">Download the template to ensure your data is formatted correctly.</p>
        </div>
        <Button variant="secondary" onClick={handleDownloadTemplate} className="text-xs flex items-center h-8">
          <Download size={14} className="mr-2" /> Download Template
        </Button>
      </div>

      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 cursor-pointer
            ${isDragging 
              ? 'border-navbar-accent-1 bg-navbar-accent-1/5 scale-[1.02]' 
              : 'border-gray-300 hover:border-navbar-accent-2 hover:bg-gray-50'
            }
          `}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload-input"
          />
          <label htmlFor="csv-upload-input" className="cursor-pointer flex flex-col items-center">
            <div className={`p-4 rounded-full mb-4 ${isDragging ? 'bg-navbar-accent-1/20 text-navbar-accent-1' : 'bg-gray-100 text-gray-500'}`}>
              <Upload size={32} />
            </div>
            <p className="text-lg font-medium text-gray-700">
              Click to upload or drag and drop
            </p>
            <p className="text-sm text-gray-500 mt-1">
              CSV files only (max 5MB)
            </p>
          </label>
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg border flex justify-between items-center">
          <div className="flex items-center">
            <div className="bg-green-100 p-2 rounded-lg mr-3">
              <FileText className="text-green-600 w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button 
            onClick={() => { setFile(null); setParsedData([]); }}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {parsing && (
        <div className="flex justify-center py-8">
          <Spinner size="lg" color="primary" />
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Data Preview</h3>
            <div className="flex space-x-3 text-sm">
              <span className="text-green-600 flex items-center"><CheckCircle size={14} className="mr-1"/> {validCount} Valid</span>
              {invalidCount > 0 && (
                <span className="text-red-600 flex items-center"><AlertCircle size={14} className="mr-1"/> {invalidCount} Invalid</span>
              )}
            </div>
          </div>
          
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Cost</th>
                  <th className="px-4 py-2">Min Stock</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.map((row, idx) => (
                  <tr key={idx} className={`border-b ${!row.isValid ? 'bg-red-50' : 'bg-white'}`}>
                    <td className="px-4 py-2">
                      {row.isValid ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <div className="group relative">
                          <AlertCircle size={16} className="text-red-500 cursor-help" />
                          <div className="absolute left-6 top-0 w-48 p-2 bg-red-800 text-white text-xs rounded shadow-lg hidden group-hover:block z-50">
                            {row.errors.join(', ')}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-2">{row.sku}</td>
                    <td className="px-4 py-2">{row.category_name}</td>
                    <td className="px-4 py-2">{row.cost_price}</td>
                    <td className="px-4 py-2">{row.min_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Button>
            <Button 
              variant="primary" 
              onClick={handleSubmit} 
              disabled={uploading || validCount === 0}
              className="min-w-[120px]"
            >
              {uploading ? <Spinner /> : `Import ${validCount} Items`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CsvItemImporter;
