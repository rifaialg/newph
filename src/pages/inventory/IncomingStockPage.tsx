import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Supplier, Category } from '../../types/database';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Calendar, Trash2, Truck, FileText, Plus, Package, CreditCard, Clock, Save, Archive, ShoppingBag, AlertTriangle, RotateCcw, Search, RefreshCw, ScanLine, Upload, Image as ImageIcon, Eye, X, CheckCircle, Loader2, AlertCircle, Camera, Edit2, ChevronDown, ArrowRight, FolderOpen, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import WebPImageUpload from '../../components/ui/WebPImageUpload';
import RawImageUpload from '../../components/ui/RawImageUpload';
import { analyzeInvoiceImage } from '../../services/aiService';
import { ParsedLineItem } from '../../services/ocrService';
import * as XLSX from 'xlsx'; 

// --- 1. Strict Type Definitions ---

interface BaseItemInput {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_cost: number; // Harga Beli
  image_file?: File | null;
}

interface InventoryItemInput extends BaseItemInput {
  type: 'inventory';
  min_stock: number;
}

interface MasterProductInput extends BaseItemInput {
  type: 'master';
  selling_price: number;
  sku?: string;
  category_id: number;
  min_stock: number;
}

type IncomingItem = InventoryItemInput | MasterProductInput;
type StockDestination = 'warehouse' | 'product_master';

const UNIT_OPTIONS = ['Gr', 'Ltr', 'Kg', 'Dus', 'Box', 'Pcs', 'Btl', 'Pack', 'Sak', 'Ikat', 'Butir'] as const;
type UnitType = typeof UNIT_OPTIONS[number] | string;

const generateSkuFromName = (name: string) => {
    const prefix = 'AR'; 
    let namePart = 'XXXX';
    
    if (name) {
        const cleanName = name.trim().toUpperCase();
        const words = cleanName.split(/\s+/);

        if (words.length >= 2) {
            const firstLetter = words[0].charAt(0);
            let secondWordPart = words[1].substring(0, 3);
            if (secondWordPart.length < 3) {
                secondWordPart = secondWordPart.padEnd(3, 'X');
            }
            namePart = firstLetter + secondWordPart;
        } else if (words.length === 1) {
            namePart = words[0].substring(0, 4).padEnd(4, 'X');
        }
    }

    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${namePart}-${randomNum}`;
};

const IncomingStockPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const costInputRef = useRef<HTMLInputElement>(null);
  
  // --- Persistent State Logic ---
  const loadState = <T,>(key: string, defaultValue: T): T => {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed === null && defaultValue !== null) return defaultValue;
        return parsed;
      } catch (e) {
        if (typeof defaultValue === 'string') return saved as unknown as T;
        return defaultValue;
      }
    }
    return defaultValue;
  };

  // Transaction State
  const [date, setDate] = useState(() => loadState('incoming_date', new Date().toISOString().split('T')[0]));
  const [referenceNo, setReferenceNo] = useState(() => loadState('incoming_ref', ''));
  const [supplierId, setSupplierId] = useState<number | ''>(() => loadState('incoming_supplier', ''));
  const [notes, setNotes] = useState(() => loadState('incoming_notes', ''));
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'tempo'>('cash');
  const [tempoDays, setTempoDays] = useState<number>(() => loadState('incoming_tempo', 30));
  const [destination, setDestination] = useState<StockDestination>(() => loadState('incoming_dest', 'warehouse'));

  // Item Input State
  const [itemName, setItemName] = useState(() => loadState('incoming_item_name', ''));
  const [itemQty, setItemQty] = useState<number | ''>(() => loadState('incoming_item_qty', 1));
  const [itemUnit, setItemUnit] = useState<UnitType | ''>(() => loadState('incoming_item_unit', ''));
  const [itemCost, setItemCost] = useState<number | ''>(() => loadState('incoming_item_cost', 0));
  const [itemSellingPrice, setItemSellingPrice] = useState<number | ''>(() => loadState('incoming_item_sell', 0));
  const [itemSku, setItemSku] = useState(() => loadState('incoming_item_sku', ''));
  const [itemCategoryId, setItemCategoryId] = useState<number | ''>(() => loadState('incoming_item_cat', ''));
  const [itemMinStock, setItemMinStock] = useState<number | ''>(() => loadState('incoming_item_min', 10));
  const [itemImage, setItemImage] = useState<File | null>(null);
  
  const [selectedItems, setSelectedItems] = useState<IncomingItem[]>([]); 
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isGeneratingRef, setIsGeneratingRef] = useState(false);
  
  // OCR / AI State
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  const [isAnalyzingInvoice, setIsAnalyzingInvoice] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrResults, setOcrResults] = useState<ParsedLineItem[]>([]);
  const [ocrError, setOcrError] = useState<string | null>(null);
  
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // --- Auto Generate Invoice Logic ---
  const generateAutoInvoiceNumber = async () => {
    setIsGeneratingRef(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateCode = `${year}${month}${day}`;
      const baseRef = `INV-AR-${dateCode}`;

      const { data, error } = await supabase
        .from('stock_movements')
        .select('note')
        .eq('movement_type', 'purchase')
        .ilike('note', `%Ref: ${baseRef}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      let sequence = 1;

      if (!error && data && data.length > 0) {
        const lastNote = data[0].note || '';
        const regex = new RegExp(`${baseRef}-(\\d{3})`);
        const match = lastNote.match(regex);
        if (match && match[1]) {
          sequence = parseInt(match[1], 10) + 1;
        }
      }

      const sequenceStr = String(sequence).padStart(3, '0');
      setReferenceNo(`${baseRef}-${sequenceStr}`);
    } catch (err) {
      setReferenceNo(`INV-AR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-001`);
    } finally {
      setIsGeneratingRef(false);
    }
  };

  useEffect(() => {
    if (!referenceNo || !referenceNo.startsWith('INV-AR-')) {
      generateAutoInvoiceNumber();
    }
  }, []);

  // --- Save State Effects ---
  useEffect(() => { localStorage.setItem('incoming_date', JSON.stringify(date)); }, [date]);
  useEffect(() => { localStorage.setItem('incoming_ref', JSON.stringify(referenceNo)); }, [referenceNo]);
  useEffect(() => { localStorage.setItem('incoming_supplier', JSON.stringify(supplierId)); }, [supplierId]);
  useEffect(() => { localStorage.setItem('incoming_notes', JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem('incoming_payment', JSON.stringify(paymentMethod)); }, [paymentMethod]);
  useEffect(() => { localStorage.setItem('incoming_tempo', JSON.stringify(tempoDays)); }, [tempoDays]);
  useEffect(() => { localStorage.setItem('incoming_dest', JSON.stringify(destination)); }, [destination]);

  // ... (Other state effects kept same)

  const handleClearForm = (forceReset = false) => {
    if (forceReset || window.confirm("Are you sure you want to clear all form data?")) {
      const keysToRemove = [
        'incoming_date', 'incoming_ref', 'incoming_supplier', 'incoming_notes',
        'incoming_payment', 'incoming_tempo', 'incoming_dest', 'incoming_item_name',
        'incoming_item_qty', 'incoming_item_unit', 'incoming_item_cost',
        'incoming_item_sell', 'incoming_item_sku', 'incoming_item_cat', 'incoming_item_min'
      ];
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      setDate(new Date().toISOString().split('T')[0]);
      generateAutoInvoiceNumber();
      
      setSupplierId('');
      setNotes('');
      setPaymentMethod('cash');
      setTempoDays(30);
      setDestination('warehouse');
      setSelectedItems([]);
      
      setItemName('');
      setItemQty(1);
      setItemUnit('');
      setItemCost(0);
      setItemSellingPrice(0);
      setItemSku('');
      setItemCategoryId('');
      setItemMinStock(10);
      setItemImage(null);
      
      setInvoiceFile(null);
      setInvoicePreviewUrl(null);
      setOcrResults([]);
      setOcrError(null);

      if (!forceReset) {
        toast.success("Form cleared & new invoice number generated.");
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [supRes, catRes] = await Promise.all([
            supabase.from('suppliers').select('*').order('name'),
            supabase.from('item_categories').select('*').order('name')
        ]);
        
        if (supRes.error) throw supRes.error;
        if (catRes.error) throw catRes.error;
        
        setSuppliers(supRes.data || []);
        setCategories(catRes.data || []);
      } catch (error: any) {
        toast.error(`Failed to load data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGenerateSmartSku = () => {
    const sku = generateSkuFromName(itemName);
    setItemSku(sku);
  };

  const handleNameBlur = () => {
      if (!itemSku && itemName && destination === 'product_master') {
          handleGenerateSmartSku();
      }
  };

  const handleFileSelect = (file: File | null) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file terlalu besar. Maksimal 5MB.");
        return;
      }
      setInvoiceFile(file);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setInvoicePreviewUrl(url);
      } else {
        setInvoicePreviewUrl(null); 
      }
      setOcrResults([]);
      setOcrError(null);
      toast.success("File berhasil dipilih!");
    } else {
      setInvoiceFile(null);
      setInvoicePreviewUrl(null);
      setOcrResults([]);
      setOcrError(null);
    }
  };

  // --- AI INVOICE SCANNER ---
  const handleInvoiceScan = async () => {
    if (!invoiceFile) {
        toast.error("Silakan upload file gambar terlebih dahulu.");
        return;
    }
    
    setIsAnalyzingInvoice(true);
    setOcrStatus('Mengirim ke AI...');
    setOcrResults([]);
    setOcrError(null);

    try {
      // Handle Excel Files
      if (invoiceFile.name.endsWith('.xlsx') || invoiceFile.name.endsWith('.xls') || invoiceFile.type.includes('sheet') || invoiceFile.type.includes('excel')) {
          const data = await invoiceFile.arrayBuffer();
          const workbook = XLSX.read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          const parsedItems: ParsedLineItem[] = jsonData.map((row: any) => {
            const name = row['Nama Barang'] || row['Item'] || row['Name'] || 'Unknown';
            return {
                name: name,
                quantity: Number(row['Qty'] || row['Quantity'] || 1),
                unit: row['Satuan'] || row['Unit'] || 'pcs',
                price: Number(row['Harga'] || row['Price'] || 0),
                sku: row['SKU'] || generateSkuFromName(name),
                category: row['Kategori'] || row['Category'] || '',
                selling_price: Number(row['Harga Jual'] || row['Selling Price'] || 0),
                min_stock: Number(row['Min Stock'] || 10),
                total: 0,
                confidence: 1
            };
          });
          
          setOcrResults(parsedItems);
          toast.success(`Berhasil membaca ${parsedItems.length} baris dari Excel.`);
          return;
      }

      // --- USE AI SERVICE FOR IMAGE ---
      setOcrStatus('AI sedang menganalisis struk...');
      const result = await analyzeInvoiceImage(invoiceFile);

      if (result && result.items.length > 0) {
          const mappedItems: ParsedLineItem[] = result.items.map(item => ({
              name: item.name,
              quantity: item.qty,
              unit: item.unit,
              price: item.unit_price,
              sku: generateSkuFromName(item.name),
              min_stock: 10,
              total: item.qty * item.unit_price,
              confidence: 0.9
          }));

          setOcrResults(mappedItems);
          if (result.date) setDate(result.date);
          toast.success(`AI berhasil mendeteksi ${mappedItems.length} item!`);
      } else {
          setOcrError("AI tidak menemukan item dalam gambar. Coba gambar yang lebih jelas.");
      }

    } catch (error: any) {
      console.error("Scan Error:", error);
      setOcrError(error.message || "Gagal memproses gambar.");
      toast.error("Gagal memproses gambar.");
    } finally {
      setIsAnalyzingInvoice(false);
      // Safety measure: Ensure body overflow is reset if any library messed it up
      document.body.style.overflow = '';
    }
  };

  const handleApplyOcrResults = () => {
    const newItems: IncomingItem[] = ocrResults.map(item => {
      let catId = item.category_id;
      if (!catId && item.category) {
          const found = categories.find(c => c.name.toLowerCase() === item.category?.toLowerCase());
          if (found) catId = found.id;
      }

      const baseItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: item.name || 'Unknown Item',
        quantity: item.quantity || 1,
        unit: item.unit || 'pcs',
        unit_cost: item.price || 0,
        image_file: null
      };

      if (destination === 'warehouse') {
          return {
              ...baseItem,
              type: 'inventory',
              min_stock: item.min_stock || 10
          };
      } else {
          return {
              ...baseItem,
              type: 'master',
              selling_price: item.selling_price || 0,
              sku: item.sku || generateSkuFromName(item.name || 'Item'),
              category_id: catId || 0,
              min_stock: item.min_stock || 10
          };
      }
    });

    setSelectedItems(prev => [...prev, ...newItems]);
    setOcrResults([]);
    toast.success(`${newItems.length} item ditambahkan ke daftar transaksi.`);
  };

  const handleAddOcrRow = () => {
      setOcrResults(prev => [
          ...prev,
          { name: '', quantity: 1, unit: 'pcs', price: 0, total: 0, confidence: 1, sku: '' }
      ]);
  };

  const handleRemoveOcrRow = (index: number) => {
      setOcrResults(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    if (!itemName.trim()) {
      toast.error("Nama item wajib diisi.");
      return;
    }
    
    const qty = typeof itemQty === 'string' ? parseFloat(itemQty) : itemQty;
    if (!qty || qty <= 0) {
      toast.error("Jumlah harus lebih dari 0.");
      return;
    }

    if (!itemUnit.trim()) {
      toast.error("Satuan wajib diisi.");
      return;
    }

    const cost = typeof itemCost === 'string' ? parseFloat(itemCost) : itemCost;
    if (cost < 0) {
        toast.error("Harga beli tidak boleh negatif.");
        return;
    }

    const minStock = typeof itemMinStock === 'string' ? parseFloat(itemMinStock) : itemMinStock;
    if (minStock < 0) {
        toast.error("Minimal stock tidak boleh negatif.");
        return;
    }

    let newItem: IncomingItem;

    if (destination === 'product_master') {
      const sellingPrice = typeof itemSellingPrice === 'string' ? parseFloat(itemSellingPrice) : itemSellingPrice;
      if (sellingPrice < 0) {
        toast.error("Harga jual tidak boleh negatif.");
        return;
      }
      
      if (!itemCategoryId) {
          toast.error("Kategori wajib dipilih untuk Produk Master.");
          return;
      }

      newItem = {
        type: 'master',
        id: Math.random().toString(36).substr(2, 9),
        name: itemName.trim(),
        quantity: qty,
        unit: itemUnit.trim(),
        unit_cost: cost || 0,
        selling_price: sellingPrice,
        sku: itemSku,
        category_id: Number(itemCategoryId),
        min_stock: minStock || 10,
        image_file: itemImage
      };
    } else {
        newItem = {
            type: 'inventory',
            id: Math.random().toString(36).substr(2, 9),
            name: itemName.trim(),
            quantity: qty,
            unit: itemUnit.trim(),
            unit_cost: cost || 0,
            image_file: itemImage,
            min_stock: minStock || 10
        };
    }

    setSelectedItems(prev => [...prev, newItem]);
    
    setItemName(''); 
    setItemQty(1); 
    setItemUnit(''); 
    setItemCost(0); 
    setItemSellingPrice(0); 
    setItemSku(''); 
    setItemCategoryId(''); 
    setItemMinStock(10); 
    setItemImage(null);
    
    toast.success("Item ditambahkan ke daftar.");
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const handlePreSubmitValidation = () => {
    if (!supplierId) {
      toast.error("Pilih supplier terlebih dahulu.");
      return;
    }
    if (!date) {
      toast.error("Tanggal wajib diisi.");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Belum ada item yang ditambahkan.");
      return;
    }
    setShowConfirmationModal(true);
  };

  const handleFinalSubmit = async () => {
    setShowConfirmationModal(false);
    setIsSubmitting(true);
    try {
      const supplierName = suppliers.find(s => s.id === supplierId)?.name;
      
      let paymentNote = `Payment: ${paymentMethod.toUpperCase()}`;
      if (paymentMethod === 'tempo') {
        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + tempoDays);
        paymentNote += ` (${tempoDays} days). Due: ${dueDate.toLocaleDateString('id-ID')}`;
      }

      const destNote = destination === 'warehouse' ? '[GUDANG]' : '[PRODUK JADI]';
      const fullNote = `${destNote} Incoming from ${supplierName}. Ref: ${referenceNo || '-'}. ${paymentNote}. ${notes}`;

      const { data: locations } = await supabase.from('locations').select('id').limit(1);
      const fallbackLocationId = locations?.[0]?.id;

      if (!fallbackLocationId) {
          throw new Error("System Error: No default location found. Please contact support.");
      }

      if (destination === 'warehouse') {
          await processWarehouseItems(selectedItems as InventoryItemInput[], fallbackLocationId, fullNote);
          toast.success("Data berhasil disimpan ke Stok Gudang (Bahan Baku).");
      } else {
          await processMasterItems(selectedItems as MasterProductInput[], fallbackLocationId, fullNote);
          toast.success("Data berhasil disimpan ke Katalog Produk & Stok.");
      }

      handleClearForm(true); 

      if (destination === 'warehouse') {
        navigate('/opname/sessions');
      } else {
        navigate('/inventory/items');
      }
      
    } catch (error: any) {
      console.error("Submission Error:", error);
      toast.error(`Gagal menyimpan transaksi: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ... (processWarehouseItems, processMasterItems, uploadImage functions remain same) ...
  const processWarehouseItems = async (items: InventoryItemInput[], locationId: number, note: string) => {
      const targetCategoryName = 'Bahan Baku';
      let rawMaterialCategoryId: number;
      
      const { data: catData } = await supabase.from('item_categories').select('id').ilike('name', targetCategoryName).maybeSingle();
      if (catData) {
          rawMaterialCategoryId = catData.id;
      } else {
          const { data: newCat, error: catError } = await supabase.from('item_categories').insert({ name: targetCategoryName }).select('id').single();
          if (catError) throw catError;
          rawMaterialCategoryId = newCat.id;
      }

      for (const item of items) {
          let itemId: number;

          const { data: existingItem } = await supabase
              .from('items')
              .select('id, category_id, cost_price')
              .ilike('name', item.name)
              .maybeSingle();

          if (existingItem) {
              itemId = existingItem.id;
              const updates: any = {};
              if (existingItem.cost_price !== item.unit_cost) updates.cost_price = item.unit_cost;
              if (item.min_stock !== undefined) updates.min_stock = item.min_stock;

              if (Object.keys(updates).length > 0) {
                  await supabase.from('items').update(updates).eq('id', itemId);
              }
          } else {
              let imageUrl = null;
              if (item.image_file) {
                  imageUrl = await uploadImage(item.image_file);
              }

              const { data: newItem, error: createError } = await supabase
                  .from('items')
                  .insert({
                      name: item.name,
                      category_id: rawMaterialCategoryId,
                      unit: item.unit,
                      cost_price: item.unit_cost,
                      selling_price: 0,
                      min_stock: item.min_stock || 10,
                      image_url: imageUrl,
                      is_active: true
                  })
                  .select('id')
                  .single();
              
              if (createError) throw createError;
              itemId = newItem.id;
          }

          await supabase.from('stock_movements').insert({
              item_id: itemId,
              location_id: locationId,
              quantity_change: item.quantity,
              movement_type: 'purchase',
              note: note,
              created_by: user?.id
          });
      }
  };

  const processMasterItems = async (items: MasterProductInput[], locationId: number, note: string) => {
      for (const item of items) {
          let itemId: number;
          let imageUrl: string | null = null;

          if (item.image_file) {
              imageUrl = await uploadImage(item.image_file);
          }

          const { data: existingItem } = await supabase
              .from('items')
              .select('id, image_url')
              .ilike('name', item.name)
              .maybeSingle();

          if (existingItem) {
              itemId = existingItem.id;
              const updatePayload: any = {
                  cost_price: item.unit_cost,
                  selling_price: item.selling_price,
                  min_stock: item.min_stock,
                  category_id: item.category_id 
              };
              if (imageUrl) updatePayload.image_url = imageUrl;
              
              await supabase.from('items').update(updatePayload).eq('id', itemId);
          } else {
              const { data: newItem, error: createError } = await supabase
                  .from('items')
                  .insert({
                      name: item.name,
                      sku: item.sku || null,
                      category_id: item.category_id,
                      unit: item.unit,
                      cost_price: item.unit_cost,
                      selling_price: item.selling_price,
                      min_stock: item.min_stock,
                      image_url: imageUrl,
                      is_active: true
                  })
                  .select('id')
                  .single();

              if (createError) throw createError;
              itemId = newItem.id;
          }

          await supabase.from('stock_movements').insert({
              item_id: itemId,
              location_id: locationId,
              quantity_change: item.quantity,
              movement_type: 'purchase',
              note: note,
              created_by: user?.id
          });
      }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const filePath = `products/${fileName}`;

          const { error: uploadError } = await supabase.storage
              .from('product-images')
              .upload(filePath, file);

          if (uploadError) return null;
          
          const { data: { publicUrl } } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);
          
          return publicUrl;
      } catch (err) {
          return null;
      }
  };

  const getInputValue = (val: number | string | null) => {
    if (val === null || val === undefined || Number.isNaN(val)) return '';
    return val;
  };

  const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all shadow-sm";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <PageHeader title="Incoming Stock (Pembelian)" />
        <Button onClick={() => handleClearForm(false)} variant="secondary" className="text-xs flex items-center bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200">
          <RotateCcw className="w-3 h-3 mr-1" /> Clear Form
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Transaction Info & Invoice Scan */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* AI Invoice Scanner - REMOVED OVERFLOW HIDDEN */}
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 relative">
            <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center">
              <Camera className="w-4 h-4 mr-2" />
              Scan Gambar (AI Enhanced)
            </h3>
            
            <div className="bg-white rounded-xl border border-blue-200 p-1 mb-3">
                <RawImageUpload 
                    onImageSelected={handleFileSelect} 
                    compact={true}
                    className="h-24"
                    allowDocuments={true} 
                    label="Upload Nota / Produk"
                />
            </div>

            {invoiceFile && (
                <div className="space-y-3 animate-fade-in">
                    {invoicePreviewUrl && (
                        <div className="relative rounded-lg overflow-hidden border border-blue-200 shadow-sm group">
                            <img 
                                src={invoicePreviewUrl} 
                                alt="Invoice Preview" 
                                className="w-full h-48 object-cover object-top transition-transform duration-500 group-hover:scale-105"
                            />
                            <a 
                                href={invoicePreviewUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="absolute bottom-2 right-2 bg-white/90 p-1.5 rounded-full shadow-sm text-blue-600 hover:text-blue-800 z-10"
                                title="Lihat Gambar Penuh"
                            >
                                <Eye size={16} />
                            </a>
                        </div>
                    )}

                    {isAnalyzingInvoice && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-semibold text-blue-700">
                                <span>{ocrStatus}</span>
                                <Loader2 className="w-3 h-3 animate-spin" />
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2">
                                <div 
                                    className="bg-navbar-accent-1 h-2 rounded-full transition-all duration-1000 animate-pulse" 
                                    style={{ width: '100%' }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {ocrError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-xs text-red-700">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <p>{ocrError}</p>
                        </div>
                    )}

                    {!isAnalyzingInvoice && ocrResults.length === 0 && (
                        <Button 
                            onClick={handleInvoiceScan}
                            className="w-full py-2.5 bg-navbar-accent-1 hover:bg-navbar-accent-2 text-white shadow-md flex justify-center items-center"
                        >
                            <ScanLine className="w-4 h-4 mr-2" />
                            {ocrError ? 'Coba Lagi' : 'Analisa dengan AI'}
                        </Button>
                    )}
                </div>
            )}
          </Card>

          <Card className="p-6 border-t-4 border-t-navbar-accent-1 h-fit">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-navbar-accent-1" />
              Detail Transaksi
            </h3>
            
            <div className="space-y-4">
              {/* Destination Selection */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <label className={labelClass}>Tujuan Penyimpanan</label>
                <div className="grid grid-cols-1 gap-3">
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${destination === 'warehouse' ? 'bg-white border-blue-500 shadow-sm' : 'border-transparent hover:bg-white/50'}`}>
                    <input 
                      type="radio" 
                      name="destination" 
                      value="warehouse" 
                      checked={destination === 'warehouse'} 
                      onChange={() => setDestination('warehouse')}
                      className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-full mr-3 text-blue-600">
                        <Archive size={18} />
                      </div>
                      <div>
                        <span className="block text-sm font-bold text-gray-900">Stok Gudang</span>
                        <span className="block text-xs text-gray-500">Bahan baku (Opname)</span>
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${destination === 'product_master' ? 'bg-white border-purple-500 shadow-sm' : 'border-transparent hover:bg-white/50'}`}>
                    <input 
                      type="radio" 
                      name="destination" 
                      value="product_master" 
                      checked={destination === 'product_master'} 
                      onChange={() => setDestination('product_master')}
                      className="mr-3 w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-full mr-3 text-purple-600">
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <span className="block text-sm font-bold text-gray-900">Product Master</span>
                        <span className="block text-xs text-gray-500">Barang jadi (Katalog)</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {destination === 'warehouse' && (
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 p-3 rounded-lg text-blue-800 text-xs animate-fade-in">
                      <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                          <span className="font-bold block mb-1">Mode Stok Gudang Aktif</span>
                          Data yang diinput hanya akan masuk ke <strong>Stok Bahan Baku</strong>. Katalog Produk Utama (Master Data) tidak akan diubah atau diduplikasi.
                      </div>
                  </div>
              )}

              <div>
                <label className={labelClass}>Supplier <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Truck className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <select 
                    value={supplierId}
                    onChange={(e) => setSupplierId(Number(e.target.value))}
                    className={`${inputClass} pl-10 appearance-none`}
                    disabled={loading}
                  >
                    <option value="">Pilih Supplier...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Tanggal <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>No. Referensi / Invoice (Auto)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={referenceNo}
                    readOnly
                    placeholder="Generating..."
                    className={`${inputClass} bg-gray-100 text-gray-500 cursor-not-allowed font-mono text-xs`}
                  />
                  {isGeneratingRef && (
                    <div className="absolute right-3 top-3">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method Section */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <label className={labelClass}>Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-green-100 text-green-700 border-green-200 border shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 border hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 mr-2" /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('tempo')}
                    className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      paymentMethod === 'tempo'
                        ? 'bg-amber-100 text-amber-700 border-amber-200 border shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 border hover:bg-gray-50'
                    }`}
                  >
                    <Clock className="w-4 h-4 mr-2" /> Tempo
                  </button>
                </div>

                {paymentMethod === 'tempo' && (
                  <div className="animate-fade-in">
                    <label className="text-xs text-gray-500 mb-1 block">Jangka Waktu (Hari)</label>
                    <div className="flex items-center">
                      <input 
                        type="number" 
                        min="1"
                        value={tempoDays}
                        onChange={(e) => setTempoDays(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                      <span className="ml-3 text-sm text-gray-600">Hari</span>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-2">
                      Jatuh Tempo: {new Date(new Date(date).setDate(new Date(date).getDate() + tempoDays)).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Catatan</label>
                <textarea 
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                  className={inputClass}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Item Input & OCR Results */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* OCR Results Panel - REMOVED OVERFLOW HIDDEN & ANIMATION */}
          {ocrResults.length > 0 && (
            <Card className="p-0 border-2 border-navbar-accent-1/20 shadow-lg">
                <div className="bg-navbar-accent-1/10 p-4 flex justify-between items-center border-b border-navbar-accent-1/10">
                    <h3 className="font-bold text-navbar-accent-1 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Hasil Scan ({ocrResults.length} Item)
                    </h3>
                    <div className="flex gap-2">
                        <Button 
                            variant="secondary" 
                            onClick={() => setOcrResults([])}
                            className="text-xs py-1.5 px-3 h-auto bg-white hover:bg-red-50 hover:text-red-600"
                        >
                            Batal
                        </Button>
                        <Button 
                            onClick={handleApplyOcrResults}
                            className="text-xs py-1.5 px-3 h-auto shadow-none"
                        >
                            Masukkan ke Daftar
                        </Button>
                    </div>
                </div>
                
                {/* --- DESKTOP TABLE VIEW --- */}
                <div className="hidden md:block max-h-80 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2">Nama Barang</th>
                                <th className="px-3 py-2 w-32">SKU</th>
                                <th className="px-3 py-2 text-center w-16">Jml</th>
                                <th className="px-3 py-2 w-20">Satuan</th>
                                <th className="px-3 py-2 text-right w-28">H. Beli</th>
                                <th className="px-3 py-2 text-right w-28">H. Jual</th>
                                <th className="px-3 py-2 w-32">Kategori</th>
                                <th className="px-3 py-2 text-center w-20">Min Stk</th>
                                <th className="px-3 py-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {ocrResults.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50 group">
                                    <td className="px-3 py-2">
                                        <input 
                                            value={item.name || ''} 
                                            onChange={(e) => {
                                                const newResults = [...ocrResults];
                                                newResults[idx].name = e.target.value;
                                                setOcrResults(newResults);
                                            }}
                                            className="w-full bg-transparent focus:outline-none border-b border-transparent focus:border-navbar-accent-1 placeholder-gray-300"
                                            placeholder="Nama Item"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                            <input 
                                                value={item.sku || ''} 
                                                onChange={(e) => {
                                                    const newResults = [...ocrResults];
                                                    newResults[idx].sku = e.target.value;
                                                    setOcrResults(newResults);
                                                }}
                                                className="w-full bg-transparent focus:outline-none border-b border-transparent focus:border-navbar-accent-1 text-xs font-mono placeholder-gray-300"
                                                placeholder="Auto"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <input 
                                            type="number"
                                            value={item.quantity || ''}
                                            onChange={(e) => {
                                                const newResults = [...ocrResults];
                                                newResults[idx].quantity = parseFloat(e.target.value);
                                                setOcrResults(newResults);
                                            }}
                                            className="w-full text-center bg-transparent focus:outline-none border-b border-transparent focus:border-navbar-accent-1"
                                            placeholder="1"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <select 
                                            value={item.unit || ''} 
                                            onChange={(e) => {
                                                const newResults = [...ocrResults];
                                                newResults[idx].unit = e.target.value;
                                                setOcrResults(newResults);
                                            }}
                                            className="w-full bg-transparent focus:outline-none border-b border-transparent focus:border-navbar-accent-1 text-center appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled>Pilih</option>
                                            {UNIT_OPTIONS.map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <input 
                                            type="number"
                                            value={item.price || ''}
                                            onChange={(e) => {
                                                const newResults = [...ocrResults];
                                                newResults[idx].price = parseFloat(e.target.value);
                                                setOcrResults(newResults);
                                            }}
                                            className="w-full text-right bg-transparent focus:outline-none border-b border-transparent focus:border-navbar-accent-1"
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <input 
                                            type="number"
                                            value={item.selling_price || ''}
                                            onChange={(e) => {
                                                const newResults = [...ocrResults];
                                                newResults[idx].selling_price = parseFloat(e.target.value);
                                                setOcrResults(newResults);
                                            }}
                                            className="w-full text-right bg-transparent focus:outline-none border-b border-transparent focus:border-navbar-accent-1 text-green-600"
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <select
                                            value={item.category_id || ''}
                                            onChange={(e) => {
                                                const newResults = [...ocrResults];
                                                newResults[idx].category_id = Number(e.target.value);
                                                setOcrResults(newResults);
                                            }}
                                            className="w-full bg-transparent focus:outline-none border-b border-transparent focus:border-navbar-accent-1 text-xs"
                                        >
                                            <option value="">Pilih...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <input 
                                            type="number"
                                            value={item.min_stock || ''}
                                            onChange={(e) => {
                                                const newResults = [...ocrResults];
                                                newResults[idx].min_stock = parseFloat(e.target.value);
                                                setOcrResults(newResults);
                                            }}
                                            className="w-full text-center bg-transparent focus:outline-none border-b border-transparent focus:border-navbar-accent-1 text-xs text-gray-500"
                                            placeholder="10"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button 
                                            onClick={() => handleRemoveOcrRow(idx)}
                                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* --- MOBILE CARD VIEW --- */}
                <div className="md:hidden max-h-[60vh] overflow-y-auto p-3 space-y-3 bg-gray-50 custom-scrollbar">
                    {ocrResults.map((item, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                            <button 
                                onClick={() => handleRemoveOcrRow(idx)}
                                className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                            <div className="mb-3 pr-6">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Nama Barang</label>
                                <input 
                                    value={item.name || ''} 
                                    onChange={(e) => {
                                        const newResults = [...ocrResults];
                                        newResults[idx].name = e.target.value;
                                        setOcrResults(newResults);
                                    }}
                                    className="w-full font-semibold text-gray-800 border-b border-gray-200 focus:border-navbar-accent-1 focus:outline-none pb-1"
                                    placeholder="Nama Item"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Jumlah</label>
                                    <input 
                                        type="number"
                                        value={item.quantity || ''}
                                        onChange={(e) => {
                                            const newResults = [...ocrResults];
                                            newResults[idx].quantity = parseFloat(e.target.value);
                                            setOcrResults(newResults);
                                        }}
                                        className="w-full border border-gray-200 rounded px-2 py-1.5 focus:border-navbar-accent-1 focus:outline-none text-center"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Satuan</label>
                                    <select 
                                        value={item.unit || ''} 
                                        onChange={(e) => {
                                            const newResults = [...ocrResults];
                                            newResults[idx].unit = e.target.value;
                                            setOcrResults(newResults);
                                        }}
                                        className="w-full border border-gray-200 rounded px-2 py-1.5 focus:border-navbar-accent-1 focus:outline-none text-center appearance-none bg-white"
                                    >
                                        <option value="" disabled>Pilih</option>
                                        {UNIT_OPTIONS.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="p-2 border-t border-gray-100 bg-gray-50">
                    <button 
                        onClick={handleAddOcrRow}
                        className="w-full py-2 text-xs text-navbar-accent-1 font-medium hover:bg-amber-100/50 rounded-lg border border-dashed border-navbar-accent-1/30 flex items-center justify-center transition-colors"
                    >
                        <Plus size={14} className="mr-1" /> Tambah Baris Manual
                    </button>
                </div>
            </Card>
          )}

          {/* REMOVED OVERFLOW HIDDEN FROM INPUT CARD */}
          <Card className="p-6 min-h-[600px] flex flex-col relative">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <Package className="w-5 h-5 mr-2 text-navbar-accent-1" />
                Input Barang ({destination === 'warehouse' ? 'Bahan Baku' : 'Produk Jadi'})
                </h3>
            </div>

            {/* Manual Input Form */}
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6 relative z-10">
              <div className="grid grid-cols-1 gap-4">
                
                {/* Nama Barang */}
                <div>
                  <label className={labelClass}>
                    NAMA BARANG <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder={destination === 'warehouse' ? "Contoh: Tepung Terigu" : "Contoh: Syrup Butterscoth"}
                    className={inputClass}
                  />
                </div>

                {/* SKU Field (Only for Product Master) */}
                {destination === 'product_master' && (
                    <div>
                        <label className={labelClass}>
                            SKU (OPTIONAL)
                        </label>
                        <div className="relative flex items-center gap-2">
                            <input
                                type="text"
                                value={itemSku}
                                onChange={(e) => setItemSku(e.target.value)}
                                placeholder="Auto-generated if empty"
                                className={inputClass}
                            />
                            <button 
                                type="button" 
                                onClick={handleGenerateSmartSku}
                                className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-navbar-accent-1 hover:border-navbar-accent-1 transition-all shadow-sm"
                                title="Generate Smart SKU"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Jumlah */}
                <div>
                  <label className={labelClass}>
                    JUMLAH <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={getInputValue(itemQty)}
                    onChange={(e) => setItemQty(parseFloat(e.target.value))}
                    className={`${inputClass} text-center`}
                  />
                </div>

                {/* Satuan */}
                <div>
                  <label className={labelClass}>
                    SATUAN <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value as UnitType)}
                    className={`${inputClass} appearance-none cursor-pointer`}
                  >
                    <option value="">Pilih Satuan</option>
                    {UNIT_OPTIONS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                
                {/* Harga Beli */}
                <div>
                  <label className={labelClass}>
                    HARGA BELI SATUAN {itemUnit ? `[${itemUnit.toUpperCase()}]` : ''} <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={costInputRef}
                    type="number"
                    min="0"
                    value={getInputValue(itemCost)}
                    onChange={(e) => setItemCost(parseFloat(e.target.value))}
                    className={`${inputClass} text-center`}
                  />
                </div>

                {/* Harga Jual (Conditional) */}
                {destination === 'product_master' && (
                  <div>
                    <label className={labelClass}>
                      HARGA JUAL SATUAN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={getInputValue(itemSellingPrice)}
                      onChange={(e) => setItemSellingPrice(parseFloat(e.target.value))}
                      className={`${inputClass} text-center`}
                    />
                  </div>
                )}

                {/* Min Stock (Available for Both) */}
                <div>
                  <label className={labelClass}>
                    MINIMAL STOCK
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={getInputValue(itemMinStock)}
                    onChange={(e) => setItemMinStock(parseFloat(e.target.value))}
                    placeholder="10"
                    className={`${inputClass} text-center`}
                  />
                </div>

                {/* --- Additional Fields for Product Master --- */}
                {destination === 'product_master' && (
                  <>
                    {/* Category */}
                    <div>
                      <label className={labelClass}>
                        KATEGORI <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={itemCategoryId}
                        onChange={(e) => setItemCategoryId(Number(e.target.value))}
                        className={`${inputClass} appearance-none cursor-pointer`}
                      >
                        <option value="">Pilih Kategori</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Image Upload (Available for both, but handled differently) */}
                <div className="relative">
                    <label className={labelClass}>
                        FOTO PRODUK
                    </label>
                    <div className="h-[42px] w-full">
                        <WebPImageUpload 
                            onImageProcessed={setItemImage} 
                            className="h-full w-full"
                            compact={true} 
                        />
                    </div>
                </div>

                {/* Add Button */}
                <div className="mt-4 flex items-center justify-center">
                  <Button 
                    onClick={handleAddItem} 
                    variant="primary" 
                    className={`w-full flex justify-center items-center shadow-md transition-transform active:scale-95 py-3`}
                  >
                    <Plus size={20} className="mr-2" />
                    Tambah Item
                  </Button>
                </div>
              </div>
            </div>

            {/* Items List Table */}
            <div className="flex-1 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-bold">Nama Barang</th>
                    <th className="px-4 py-3 font-bold text-center">Qty</th>
                    <th className="px-4 py-3 font-bold text-center">Satuan</th>
                    <th className="px-4 py-3 font-bold text-center">Harga Beli (Rp)</th>
                    {destination === 'product_master' && (
                      <th className="px-4 py-3 font-bold text-center">Harga Jual (Rp)</th>
                    )}
                    <th className="px-4 py-3 font-bold text-right">Subtotal</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {selectedItems.length > 0 ? (
                    selectedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center">
                                {item.image_file && (
                                    <img 
                                        src={URL.createObjectURL(item.image_file)} 
                                        alt="Preview" 
                                        className="w-8 h-8 rounded object-cover mr-2 border border-gray-200"
                                    />
                                )}
                                <div>
                                    <div>{item.name}</div>
                                    {item.type === 'master' && item.sku && <div className="text-xs text-gray-400">{item.sku}</div>}
                                </div>
                            </div>
                        </td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{item.unit}</td>
                        <td className="px-4 py-3 text-center">{item.unit_cost.toLocaleString('id-ID')}</td>
                        {destination === 'product_master' && (
                          <td className="px-4 py-3 text-center text-green-600 font-medium">
                            {(item as MasterProductInput).selling_price?.toLocaleString('id-ID') || '-'}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {(item.quantity * item.unit_cost).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={destination === 'product_master' ? 7 : 6} className="py-12 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center">
                          <div className="bg-gray-50 p-4 rounded-full mb-3">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                          <p className="font-medium">Belum ada barang ditambahkan.</p>
                          <p className="text-xs mt-1 text-gray-500">Gunakan form di atas atau scan nota.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Total */}
            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-500">
                Total Item: <span className="font-semibold text-gray-900">{selectedItems.length}</span>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                <div className="text-right mr-4">
                  <p className="text-xs text-gray-500 uppercase font-bold">Total Pembelian</p>
                  <p className="text-2xl font-bold text-navbar-accent-1">Rp {calculateTotal().toLocaleString('id-ID')}</p>
                </div>
                <Button 
                  onClick={handlePreSubmitValidation} 
                  disabled={isSubmitting || selectedItems.length === 0} 
                  variant="primary" 
                  className="px-8 py-3 shadow-lg shadow-navbar-accent-1/20 flex items-center h-12"
                >
                  {isSubmitting ? <Spinner size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Simpan Transaksi</>}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        title="Konfirmasi Transaksi"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-800">Apakah data yang Anda input sudah benar?</h4>
              <p className="text-sm text-blue-700 mt-1">
                Pastikan semua detail transaksi pembelian sudah sesuai sebelum disimpan.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Supplier</p>
                <p className="font-medium text-gray-900">{suppliers.find(s => s.id === supplierId)?.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Tanggal</p>
                <p className="font-medium text-gray-900">{new Date(date).toLocaleDateString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Tujuan</p>
                <p className="font-medium text-gray-900 capitalize">{destination === 'warehouse' ? 'Stok Gudang (Bahan Baku)' : 'Product Master (Katalog)'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Pembayaran</p>
                <p className="font-medium text-gray-900 capitalize">{paymentMethod} {paymentMethod === 'tempo' && `(${tempoDays} Hari)`}</p>
              </div>
            </div>
            
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-center">Qty</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {selectedItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2 text-center">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-2 text-right">Rp {(item.quantity * item.unit_cost).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-gray-100 border-t border-gray-200 flex justify-between items-center">
              <span className="font-bold text-gray-700">Grand Total</span>
              <span className="font-bold text-lg text-navbar-accent-1">Rp {calculateTotal().toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="secondary" 
              onClick={() => setShowConfirmationModal(false)}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Batal
            </Button>
            <Button 
              variant="primary" 
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="shadow-lg shadow-navbar-accent-1/20"
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Konfirmasi Simpan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default IncomingStockPage;
