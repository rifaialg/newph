import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Item, Outlet } from '../../types/database';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Calendar, Search, Trash2, User, Plus, Package, Store, Truck, X, Printer, Download, FileCheck, CreditCard, Clock, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import InvoicePrint, { InvoiceData } from '../../components/inventory/InvoicePrint';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Extended Interface to include calculated stock
interface InventoryItem extends Item {
  current_stock: number;
}

interface OutcomingItem extends Partial<Item> {
  tempId: string;
  itemId?: number;
  quantity: number;
  current_stock: number;
  notes?: string;
  name?: string;
  sku?: string;
  unit?: string;
  cost_price?: number; // Added for invoice value
}

const OutcomingStockPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [distributionType, setDistributionType] = useState('');
  const [selectedOutletId, setSelectedOutletId] = useState<number | ''>('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  
  // Payment State (New)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'tempo'>('cash');
  const [tempoDays, setTempoDays] = useState<number>(30);
  
  // Validation State
  const [transactionTypeError, setTransactionTypeError] = useState('');
  const [outletError, setOutletError] = useState('');

  // Data State
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  
  // Item Selection State
  const [rows, setRows] = useState<OutcomingItem[]>([]);
  
  // Search State per Row
  const [activeSearchRow, setActiveSearchRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingRef, setIsGeneratingRef] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Invoice State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  // Confirmation Modal State
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch items, outlets, AND stock movements in parallel
        const [itemRes, outletRes, movementRes] = await Promise.all([
          supabase.from('items').select('*').eq('is_active', true).order('name'),
          supabase.from('outlets').select('*').eq('is_active', true).order('name'),
          supabase.from('stock_movements').select('item_id, quantity_change')
        ]);

        if (itemRes.error) throw itemRes.error;
        if (outletRes.error) throw outletRes.error;
        if (movementRes.error) throw movementRes.error;

        setOutlets(outletRes.data as Outlet[]);

        // Calculate stock map from movements
        const stockMap = new Map<number, number>();
        movementRes.data?.forEach((m: any) => {
            const current = stockMap.get(m.item_id) || 0;
            stockMap.set(m.item_id, current + m.quantity_change);
        });

        // Merge stock into items
        const itemsWithStock: InventoryItem[] = (itemRes.data as Item[]).map(item => ({
            ...item,
            current_stock: stockMap.get(item.id) || 0
        }));

        setAllItems(itemsWithStock);
        
        // Initialize with ONE empty row
        const initialRow: OutcomingItem = {
            tempId: Math.random().toString(36).substr(2, 9),
            quantity: 1,
            current_stock: 0,
            notes: ''
        };
        setRows([initialRow]);

      } catch (error: any) {
        toast.error(`Failed to load data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- UTILITY: Generate 5-Letter Outlet Code ---
  const getOutletCode = (name: string): string => {
    // 1. Bersihkan karakter non-alphanumeric
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    
    let code = '';
    if (words.length >= 2) {
      // Jika 2 kata atau lebih: 2 huruf pertama kata ke-1 + 3 huruf pertama kata ke-2
      // Contoh: "Artirasa Joglo" -> AR + JOG = ARJOG
      const first = words[0].slice(0, 2);
      const second = words[1].slice(0, 3);
      code = first + second;
    } else if (words.length === 1) {
      // Jika 1 kata: Ambil 5 huruf pertama
      code = words[0].slice(0, 5);
    } else {
      code = 'GENRL';
    }
    
    // Pastikan panjang 5 karakter (pad dengan 'X' jika kurang)
    return code.padEnd(5, 'X').slice(0, 5);
  };

  // --- LOGIC: Auto-Generate Reference Number ---
  const generateSuratJalanNumber = useCallback(async () => {
    // 1. Validasi awal: Hanya generate jika tipe transaksi valid
    if (!distributionType) {
        setReferenceNo('');
        return;
    }

    // Jika tipe distribusi tapi belum pilih outlet, set placeholder atau kosong
    if (distributionType === 'distribution' && !selectedOutletId) {
        setReferenceNo('SJ-XXXXX-DDMMYY-000');
        return;
    }
    
    setIsGeneratingRef(true);
    try {
        // 2. Tentukan Kode Outlet / Tipe
        let outletCode = 'GENRL'; 
        
        if (distributionType === 'distribution' && selectedOutletId) {
            const outlet = outlets.find(o => o.id === selectedOutletId);
            if (outlet) {
                outletCode = getOutletCode(outlet.name);
            }
        } else {
            // Untuk tipe lain (wastage, internal_use), buat kode dari tipe
            // Wastage -> WASTA, Internal -> INTER
            outletCode = distributionType.substring(0, 5).toUpperCase().padEnd(5, 'X');
        }

        // 3. Format Tanggal: DDMMYY
        const today = new Date(date);
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yy = String(today.getFullYear()).slice(-2);
        const dateCode = `${dd}${mm}${yy}`;
        
        // 4. Base Format: SJ-[Outlet]-[Date]
        // Ini adalah kunci independensi: Base Ref unik per Outlet & Tanggal
        const baseRef = `SJ-${outletCode}-${dateCode}`;

        // 5. Query DB: Cari nomor urut terakhir UNTUK BASE REF INI SAJA
        const { data, error } = await supabase
            .from('stock_movements')
            .select('note')
            .ilike('note', `%Ref: ${baseRef}-%`) // Filter ketat berdasarkan kode outlet
            .order('created_at', { ascending: false })
            .limit(1);
            
        let sequence = 1;
        
        if (!error && data && data.length > 0) {
            const lastNote = data[0].note || '';
            // Regex untuk mengambil 3 digit terakhir setelah baseRef spesifik ini
            const regex = new RegExp(`${baseRef}-(\\d{3})`);
            const match = lastNote.match(regex);
            if (match && match[1]) {
                sequence = parseInt(match[1], 10) + 1;
            }
        }
        
        // 6. Format Batch: 001, 002, dst
        const batch = String(sequence).padStart(3, '0');
        setReferenceNo(`${baseRef}-${batch}`);

    } catch (e) {
        console.error("Auto-gen ref error", e);
        setReferenceNo(`SJ-ERROR-${Date.now().toString().slice(-4)}`);
    } finally {
        setIsGeneratingRef(false);
    }
  }, [selectedOutletId, distributionType, date, outlets]);

  // Trigger generator saat dependency berubah
  useEffect(() => {
    generateSuratJalanNumber();
  }, [generateSuratJalanNumber]);

  const handleAddRow = () => {
    const newRow: OutcomingItem = {
      tempId: Math.random().toString(36).substr(2, 9),
      quantity: 1,
      current_stock: 0,
      notes: ''
    };
    setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (tempId: string) => {
    if (rows.length <= 1) {
        // If it's the last row, just reset it instead of removing
        setRows([{
            tempId: Math.random().toString(36).substr(2, 9),
            quantity: 1,
            current_stock: 0,
            notes: ''
        }]);
        return;
    }
    setRows(prev => prev.filter(row => row.tempId !== tempId));
  };

  const handleSelectItem = (rowId: string, item: InventoryItem) => {
    if (rows.some(r => r.itemId === item.id && r.tempId !== rowId)) {
        toast.warning(`${item.name} is already selected in another row.`);
        return;
    }

    setRows(prev => prev.map(row => {
      if (row.tempId === rowId) {
        return {
          ...row,
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          cost_price: item.cost_price,
          current_stock: item.current_stock, // Use the stock from allItems which is already calculated
          quantity: 1
        };
      }
      return row;
    }));
    
    setActiveSearchRow(null);
    setSearchQuery('');
  };

  const updateRowField = (rowId: string, field: keyof OutcomingItem, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.tempId === rowId) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const filteredItems = allItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handlePreSubmitValidation = () => {
    setTransactionTypeError('');
    setOutletError('');
    let hasError = false;

    if (!distributionType) {
      setTransactionTypeError('Transaction Type is required.');
      hasError = true;
    }

    if (distributionType === 'distribution' && !selectedOutletId) {
      setOutletError('Destination Outlet is required.');
      hasError = true;
    }

    if (hasError) {
      toast.error("Please fill in all required fields.");
      return;
    }
    
    const validRows = rows.filter(r => r.itemId);
    
    if (validRows.length === 0) {
      toast.error("Please add at least one item.");
      return;
    }
    
    for (const item of validRows) {
        if (!item.quantity || item.quantity <= 0) {
            toast.error(`Quantity for ${item.name} must be greater than 0`);
            return;
        }
        if (item.quantity > item.current_stock) {
            toast.error(`Insufficient stock for ${item.name}. Available: ${item.current_stock}`);
            return;
        }
    }

    // If validation passes, show confirmation modal
    setShowConfirmationModal(true);
  };

  const handleFinalSubmit = async () => {
    setShowConfirmationModal(false);
    setIsSubmitting(true);
    try {
      const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('id')
        .limit(1);
      
      if (locError) throw locError;
      
      const fallbackLocationId = locations?.[0]?.id;

      if (!fallbackLocationId) {
        throw new Error("System Error: No default location found.");
      }

      const outletName = outlets.find(o => o.id === selectedOutletId)?.name || 'Unknown Outlet';
      const notePrefix = distributionType === 'distribution' 
        ? `Distribution to: ${outletName}` 
        : `Outcoming: ${distributionType}`;
      
      // Build payment info string
      let paymentInfo = `Payment: ${paymentMethod.toUpperCase()}`;
      if (paymentMethod === 'tempo') {
        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + tempoDays);
        paymentInfo += ` (${tempoDays} days). Due: ${dueDate.toLocaleDateString('id-ID')}`;
      }

      const masterNote = `${notePrefix}. Ref: ${referenceNo}. ${paymentInfo}. ${notes}`;

      const validRows = rows.filter(r => r.itemId);
      const movements = validRows.map(item => {
        const itemNote = item.notes ? `${masterNote} [Item Note: ${item.notes}]` : masterNote;
        
        return {
          item_id: item.itemId,
          location_id: fallbackLocationId,
          quantity_change: -Math.abs(item.quantity),
          movement_type: distributionType,
          note: itemNote,
          created_by: user?.id
        };
      });

      const { error } = await supabase.from('stock_movements').insert(movements);
      if (error) throw error;

      toast.success("Shipment confirmed successfully!");
      
      // Prepare Invoice Data
      const generatedInvoice: InvoiceData = {
        referenceNo: referenceNo,
        date: date,
        outletName: distributionType === 'distribution' ? outletName : distributionType.toUpperCase(),
        type: distributionType,
        dispatcherName: user?.full_name || 'Admin',
        notes: `${notes}`, 
        paymentMethod: paymentMethod === 'tempo' ? `Tempo ${tempoDays} Hari` : 'Cash', 
        items: validRows.map(r => ({
          name: r.name || 'Unknown',
          sku: r.sku || '-',
          quantity: r.quantity,
          unit: r.unit || 'pcs',
          price: r.cost_price || 0
        }))
      };

      setInvoiceData(generatedInvoice);
      setShowInvoiceModal(true);
      
    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseInvoice = () => {
    setShowInvoiceModal(false);
    setInvoiceData(null);
    // Reset Form
    setRows([{
      tempId: Math.random().toString(36).substr(2, 9),
      quantity: 1,
      current_stock: 0,
      notes: ''
    }]);
    // Reference will be regenerated automatically via useEffect when state resets
    setNotes('');
    setDistributionType('');
    setSelectedOutletId('');
    setPaymentMethod('cash');
    setTempoDays(30);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    // IMPORTANT: Target the specific print area ID defined in index.css and InvoicePrint component
    const element = document.getElementById('invoice-print-area');
    
    if (!element) {
      toast.error("Invoice element not found. Please ensure invoice is visible.");
      return;
    }

    setIsGeneratingPdf(true);
    const toastId = toast.loading("Generating PDF...");

    try {
      // Use a slight delay to ensure rendering
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(element, { 
        scale: 2, // Higher scale for better quality
        useCORS: true, // Needed for external images (logo)
        logging: false,
        backgroundColor: '#ffffff', // Force white background
        windowWidth: 210 * 3.7795275591, // A4 width in pixels (approx)
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice-${invoiceData?.referenceNo || 'draft'}.pdf`);
      
      toast.success("PDF Downloaded successfully", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF", { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all shadow-sm";
  const errorInputClass = "w-full px-4 py-2.5 bg-red-50 border border-red-500 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-200 transition-all shadow-sm";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-6 pb-20 print:hidden">
      <PageHeader title="Distribution (Outcoming)" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-6 border-t-4 border-t-navbar-accent-1 h-fit sticky top-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Truck className="w-5 h-5 mr-2 text-navbar-accent-1" />
              Shipment Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Transaction Type <span className="text-red-500">*</span>
                </label>
                <select 
                  value={distributionType}
                  onChange={(e) => {
                    setDistributionType(e.target.value);
                    if (e.target.value) setTransactionTypeError('');
                  }}
                  className={transactionTypeError ? errorInputClass : inputClass}
                >
                  <option value="" disabled>Select Type...</option>
                  <option value="distribution">Distribution to Outlet</option>
                  <option value="wastage">Spoilage / Damaged</option>
                  <option value="internal_use">Internal Use / Tester</option>
                  <option value="other">Other</option>
                </select>
                {transactionTypeError && (
                  <p className="text-red-500 text-xs mt-1 ml-1">{transactionTypeError}</p>
                )}
              </div>

              <div className={`transition-all duration-300 ${distributionType === 'distribution' ? 'opacity-100 max-h-24' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                <label className={labelClass}>
                  Destination Outlet <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <select 
                    value={selectedOutletId}
                    onChange={(e) => {
                      setSelectedOutletId(Number(e.target.value));
                      setReferenceNo('Generating...'); // Immediate visual feedback
                      if (e.target.value) setOutletError('');
                    }}
                    className={`${outletError ? errorInputClass : inputClass} pl-10 appearance-none bg-blue-50/50 border-blue-200`}
                  >
                    <option value="">Select Outlet...</option>
                    {outlets.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                {outletError && (
                  <p className="text-red-500 text-xs mt-1 ml-1">{outletError}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>Date</label>
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
                <label className={labelClass}>Surat Jalan / Ref No. (Auto)</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={referenceNo}
                        readOnly
                        placeholder="Menunggu Outlet..."
                        className={`${inputClass} bg-gray-100 text-gray-500 cursor-not-allowed font-mono text-xs`}
                    />
                    {isGeneratingRef && (
                        <div className="absolute right-3 top-3">
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </div>
                    )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1 ml-1">Format: SJ-[Outlet]-[DDMMYY]-[Batch]</p>
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
                <label className={labelClass}>Notes</label>
                <textarea 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Driver name, plate number, etc..."
                  className={inputClass}
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className={labelClass}>Dispatcher</label>
                <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <User className="w-4 h-4 mr-2" />
                  {user?.full_name || 'Current User'}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 min-h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <Package className="w-5 h-5 mr-2 text-navbar-accent-1" />
                Items to Ship
                </h3>
                <button 
                    onClick={handleAddRow}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-navbar-accent-1 text-white hover:bg-navbar-accent-2 shadow-lg shadow-navbar-accent-1/30 transition-all hover:scale-110 active:scale-95"
                    title="Add Row"
                >
                    <Plus size={18} />
                </button>
            </div>

            {/* Items List */}
            <div className="flex-1 space-y-3">
                {rows.map((row, index) => {
                    // Calculate remaining stock dynamically
                    const remainingStock = (row.current_stock || 0) - (row.quantity || 0);
                    const isCritical = remainingStock < 0;
                    const isLow = remainingStock === 0;

                    return (
                    <div key={row.tempId} className={`bg-gray-50 p-4 rounded-xl border transition-colors relative group ${isCritical ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:border-navbar-accent-1/30'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                            
                            {/* Product Selector */}
                            <div className="md:col-span-5 relative">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 md:hidden">Product</label>
                                {row.itemId ? (
                                    <div 
                                        onClick={() => { setActiveSearchRow(row.tempId); setSearchQuery(''); }}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 cursor-pointer hover:border-navbar-accent-1 flex justify-between items-center"
                                    >
                                        <div>
                                            <div className="font-medium text-sm">{row.name}</div>
                                            <div className="text-xs text-gray-500">{row.sku}</div>
                                        </div>
                                        
                                        {/* --- STOCK BADGE UPDATED --- */}
                                        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center font-medium ${
                                            isCritical ? 'bg-red-100 text-red-700 border border-red-200' : 
                                            isLow ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 
                                            'bg-green-100 text-green-700 border border-green-200'
                                        }`}>
                                            {isCritical ? <AlertTriangle size={12} className="mr-1" /> : null}
                                            Sisa: {remainingStock} {row.unit}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search item..."
                                            value={activeSearchRow === row.tempId ? searchQuery : ''}
                                            onFocus={() => setActiveSearchRow(row.tempId)}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
                                        />
                                        {activeSearchRow === row.tempId && (
                                            <div className="absolute z-20 mt-1 w-full bg-white rounded-lg shadow-xl border border-gray-100 max-h-48 overflow-y-auto">
                                                {filteredItems.length > 0 ? (
                                                    filteredItems.map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => handleSelectItem(row.tempId, item)}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-none text-sm group transition-colors"
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-medium text-gray-800 group-hover:text-navbar-accent-1 transition-colors">{item.name}</span>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.current_stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                                    {item.current_stock} {item.unit}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-gray-400 mt-0.5 font-mono">
                                                                {item.sku || 'No SKU'}
                                                            </div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="p-3 text-center text-xs text-gray-500">No items found</div>
                                                )}
                                                <button 
                                                    onClick={() => setActiveSearchRow(null)}
                                                    className="w-full text-center p-2 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Quantity */}
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 md:hidden">Qty</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        value={row.quantity}
                                        onChange={(e) => updateRowField(row.tempId, 'quantity', parseFloat(e.target.value) || 0)}
                                        className={`w-full px-3 py-2.5 bg-white border rounded-lg text-center font-bold text-sm focus:outline-none focus:ring-2 ${
                                            isCritical ? 'border-red-500 text-red-600 focus:ring-red-200' : 'border-gray-200 text-gray-900 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1'
                                        }`}
                                    />
                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{row.unit}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="md:col-span-4">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 md:hidden">Remarks</label>
                                <input
                                    type="text"
                                    value={row.notes || ''}
                                    onChange={(e) => updateRowField(row.tempId, 'notes', e.target.value)}
                                    placeholder="Batch / Note..."
                                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1"
                                />
                            </div>

                            {/* Delete Action */}
                            <div className="md:col-span-1 flex justify-end md:justify-center pt-2 md:pt-0">
                                <button 
                                    onClick={() => handleRemoveRow(row.tempId)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove Item"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        
                        {/* Error Message inline */}
                        {isCritical && (
                            <div className="mt-2 text-xs text-red-600 flex items-center">
                                <AlertCircle size={12} className="mr-1" />
                                Stok tidak mencukupi! (Kurang {Math.abs(remainingStock)} {row.unit})
                            </div>
                        )}
                    </div>
                )})}
            </div>

            {/* Footer Total */}
            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-500">
                Total Items: <span className="font-semibold text-gray-900">{rows.filter(r => r.itemId).length}</span>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <Button 
                  onClick={handlePreSubmitValidation} 
                  disabled={isSubmitting || rows.filter(r => r.itemId).length === 0} 
                  variant="primary"
                  className="w-full sm:w-auto px-8 py-3 shadow-lg shadow-navbar-accent-1/20"
                >
                  {isSubmitting ? <Spinner /> : 'Confirm Shipment'}
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
        title="Konfirmasi Pengiriman"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-800">Periksa Kembali Data Anda</h4>
              <p className="text-sm text-blue-700 mt-1">
                Pastikan semua detail pengiriman sudah benar sebelum melanjutkan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div>
              <p className="text-gray-500 text-xs uppercase font-bold">No. Referensi</p>
              <p className="font-medium text-gray-900">{referenceNo}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase font-bold">Tanggal</p>
              <p className="font-medium text-gray-900">{new Date(date).toLocaleDateString('id-ID')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase font-bold">Tujuan</p>
              <p className="font-medium text-gray-900">
                {distributionType === 'distribution' 
                  ? outlets.find(o => o.id === selectedOutletId)?.name 
                  : distributionType}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase font-bold">Pembayaran</p>
              <p className="font-medium text-gray-900 uppercase">{paymentMethod} {paymentMethod === 'tempo' && `(${tempoDays} Hari)`}</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Ringkasan Barang</h4>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.filter(r => r.itemId).map((row, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 text-center font-medium">{row.quantity} {row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="secondary" 
              onClick={() => setShowConfirmationModal(false)}
              className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Periksa Kembali
            </Button>
            <Button 
              variant="primary" 
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="shadow-lg shadow-navbar-accent-1/20"
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Ya, Data Benar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Modal */}
      {showInvoiceModal && invoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full text-green-600">
                  <FileCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Shipment Confirmed</h3>
                  <p className="text-sm text-gray-500">Transaction recorded successfully.</p>
                </div>
              </div>
              <button onClick={handleCloseInvoice} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100 flex justify-center">
              <div className="shadow-lg rounded-lg overflow-hidden bg-white w-full max-w-[210mm] transform scale-100 md:scale-100 origin-top">
                {/* Mobile Scaling Wrapper */}
                <div className="md:w-auto w-full overflow-x-auto">
                   {/* CRITICAL FIX: Changed ID to match CSS print selector */}
                   <InvoicePrint data={invoiceData} id="invoice-print-area" />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 bg-white rounded-b-2xl flex justify-end gap-3">
              <Button variant="secondary" onClick={handleCloseInvoice}>
                Close
              </Button>
              <Button variant="secondary" onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="flex items-center">
                {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download size={18} className="mr-2" />}
                Download PDF
              </Button>
              <Button variant="primary" onClick={handlePrint} className="flex items-center shadow-lg shadow-navbar-accent-1/20">
                <Printer size={18} className="mr-2" /> Print Invoice
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutcomingStockPage;
