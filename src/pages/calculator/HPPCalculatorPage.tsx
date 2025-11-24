import React, { useState } from 'react';
import { toast } from 'sonner';
import { 
  Calculator, Plus, Trash2, Sparkles, Save, 
  Target, ChevronDown, Zap, Package, DollarSign,
  AlertTriangle, X, FileSpreadsheet, AlertCircle,
  TrendingUp, TrendingDown, Wallet, Image as ImageIcon, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import { generateHPPEstimates } from '../../services/aiService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import RawImageUpload from '../../components/ui/RawImageUpload';
import Skeleton from '../../components/ui/Skeleton';

// --- Types ---
interface CostItem {
  id: string;
  name: string;
  usageQty: number;
  usageUnit: string;
  buyPrice: number;
  buyQty: number;
  buyUnit: string;
}

interface FixedCostItem {
  id: string;
  name: string;
  monthlyCost: number;
}

// Satuan yang umum digunakan
const UNIT_OPTIONS = ['g', 'kg', 'ml', 'l', 'pcs', 'butir', 'lembar', 'ikat', 'siung', 'sdm', 'sdt', 'box', 'lusin', 'bal'];

const HPPCalculatorPage: React.FC = () => {
  const { user } = useAuth();
  
  // --- State: Input Data ---
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Makanan & Minuman');
  const [productImage, setProductImage] = useState<File | null>(null);
  
  // --- State: Variable Costs (Bahan Baku) ---
  const [ingredients, setIngredients] = useState<CostItem[]>([
    { id: '1', name: '', usageQty: 0, usageUnit: 'pcs', buyPrice: 0, buyQty: 1, buyUnit: 'pcs' }
  ]);

  // --- State: Fixed Costs (Overhead) ---
  const [targetSales, setTargetSales] = useState<number>(1000); 
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>([
    { id: '1', name: 'Sewa Tempat (per bulan)', monthlyCost: 0 },
    { id: '2', name: 'Listrik & Air (per bulan)', monthlyCost: 0 },
    { id: '3', name: 'Gaji Karyawan (per bulan)', monthlyCost: 0 }
  ]);

  // --- State: Results & UI ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [suggestedPrice, setSuggestPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // --- Helper: Unit Conversion Logic ---
  const getConversionFactor = (from: string, to: string): number | null => {
    const normFrom = from.toLowerCase();
    const normTo = to.toLowerCase();

    if (normFrom === normTo) return 1;

    // Weight
    if (normFrom === 'kg' && (normTo === 'g' || normTo === 'gr' || normTo === 'gram')) return 1000;
    if ((normFrom === 'g' || normFrom === 'gr' || normFrom === 'gram') && normTo === 'kg') return 0.001;

    // Volume
    if ((normFrom === 'l' || normFrom === 'liter') && normTo === 'ml') return 1000;
    if (normFrom === 'ml' && (normTo === 'l' || normTo === 'liter')) return 0.001;

    // Count
    if (normFrom === 'lusin' && normTo === 'pcs') return 12;
    if (normFrom === 'pcs' && normTo === 'lusin') return 1/12;
    
    // Common Kitchen Units (Approximation)
    if (normFrom === 'kg' && normTo === 'sdm') return 66; // Approx 15g per sdm
    if (normFrom === 'l' && normTo === 'sdm') return 66; // Approx 15ml per sdm

    // If units are completely different types (e.g. kg vs pcs), return null to signal error
    const weightUnits = ['kg', 'g', 'gr', 'gram', 'ons'];
    const volumeUnits = ['l', 'liter', 'ml'];
    const countUnits = ['pcs', 'butir', 'lembar', 'ikat', 'siung', 'box', 'lusin', 'bal'];

    const isFromWeight = weightUnits.includes(normFrom);
    const isToWeight = weightUnits.includes(normTo);
    const isFromVol = volumeUnits.includes(normFrom);
    const isToVol = volumeUnits.includes(normTo);
    const isFromCount = countUnits.includes(normFrom);
    const isToCount = countUnits.includes(normTo);

    if (isFromWeight && isToWeight) return 1;
    if (isFromVol && isToVol) return 1;
    if (isFromCount && isToCount) return 1;

    return null; // Incompatible units
  };

  // --- Calculations ---
  const calculateItemCost = (item: CostItem): number | 'ERROR' => {
    if (!item.buyPrice || !item.buyQty || !item.usageQty) return 0;
    
    const conversion = getConversionFactor(item.buyUnit, item.usageUnit);
    
    if (conversion === null) return 'ERROR';

    const costPerBuyUnit = item.buyPrice / item.buyQty;
    const costPerUsageUnit = costPerBuyUnit / conversion;
    
    return costPerUsageUnit * item.usageQty;
  };

  const totalVariableCost = ingredients.reduce((sum, item) => {
    const cost = calculateItemCost(item);
    return sum + (cost === 'ERROR' ? 0 : cost);
  }, 0);

  const totalFixedCostMonthly = fixedCosts.reduce((sum, item) => sum + (item.monthlyCost || 0), 0);
  const fixedCostPerUnit = targetSales > 0 ? totalFixedCostMonthly / targetSales : 0;
  const totalHPP = totalVariableCost + fixedCostPerUnit;

  // --- Handlers ---
  const handleAddIngredient = () => {
    setIngredients([...ingredients, { 
      id: Math.random().toString(36).substr(2, 9), 
      name: '', usageQty: 0, usageUnit: 'g', buyPrice: 0, buyQty: 1, buyUnit: 'kg' 
    }]);
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(ingredients.filter(i => i.id !== id));
  };

  const updateIngredient = (id: string, field: keyof CostItem, value: any) => {
    setIngredients(ingredients.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleAddFixedCost = () => {
    setFixedCosts([...fixedCosts, { 
      id: Math.random().toString(36).substr(2, 9), 
      name: '', monthlyCost: 0 
    }]);
  };

  const handleRemoveFixedCost = (id: string) => {
    setFixedCosts(fixedCosts.filter(i => i.id !== id));
  };

  const updateFixedCost = (id: string, field: keyof FixedCostItem, value: any) => {
    let safeValue = value;
    if (field === 'monthlyCost') {
        safeValue = Math.max(0, parseFloat(value) || 0);
    }
    setFixedCosts(fixedCosts.map(i => i.id === id ? { ...i, [field]: safeValue } : i));
  };

  // --- EXPORT EXCEL LOGIC ---
  const handleExportExcel = () => {
    const validIngredients = ingredients.filter(i => i.name.trim() !== '');
    
    if (validIngredients.length === 0) {
      toast.error("Tidak ada data bahan baku untuk diekspor.");
      return;
    }

    try {
      const dataToExport = validIngredients.map((item, index) => {
        const cost = calculateItemCost(item);
        return {
          "No": index + 1,
          "Nama Bahan": item.name,
          "Jumlah Pakai": item.usageQty,
          "Satuan Pakai": item.usageUnit,
          "Harga Beli (Total)": item.buyPrice,
          "Jumlah Beli": item.buyQty,
          "Satuan Beli": item.buyUnit,
          "Estimasi Biaya per Porsi": cost === 'ERROR' ? 'Error Konversi' : cost
        };
      });

      dataToExport.push({
        "No": "",
        "Nama Bahan": "TOTAL BIAYA VARIABEL",
        "Jumlah Pakai": 0,
        "Satuan Pakai": "",
        "Harga Beli (Total)": 0,
        "Jumlah Beli": 0,
        "Satuan Beli": "",
        "Estimasi Biaya per Porsi": totalVariableCost
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      
      const wscols = [
        { wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, 
        { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 20 }
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HPP Bahan Baku");

      const fileName = `HPP_${productName.replace(/[^a-z0-9]/gi, '_') || 'Draft'}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast.success("File Excel berhasil diunduh!");

    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Gagal mengunduh file Excel.");
    }
  };

  // --- AI ANALYSIS HANDLER (FIXED) ---
  const handleAIAnalysis = async () => {
    // 1. Validation
    if (!productName.trim() && !productImage) {
      toast.error("Mohon isi Nama Produk atau Upload Gambar terlebih dahulu.");
      return;
    }

    setIsAnalyzing(true);
    try {
      // 2. Call Service
      const result = await generateHPPEstimates(
          productName.trim(), 
          category, 
          productImage, 
          undefined, 
          targetSales
      );
      
      // 3. Handle Result
      if (result) {
        let newIngredients: CostItem[] = [];
        
        if (Array.isArray(result.ingredients)) {
            newIngredients = result.ingredients.map(ing => ({
                id: Math.random().toString(36).substr(2, 9),
                name: ing.name || 'Unknown',
                usageQty: ing.usage_qty || 0,
                usageUnit: ing.usage_unit || 'g',
                buyPrice: ing.buy_price || 0,
                buyQty: ing.buy_qty || 1,
                buyUnit: ing.buy_unit || 'kg'
            }));
        }

        if (Array.isArray(result.packaging)) {
            result.packaging.forEach(pkg => {
                newIngredients.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name: pkg.name || 'Packaging',
                    usageQty: pkg.usage_qty || 1,
                    usageUnit: pkg.usage_unit || 'pcs',
                    buyPrice: pkg.buy_price || 0,
                    buyQty: pkg.buy_qty || 100,
                    buyUnit: pkg.buy_unit || 'pcs'
                });
            });
        }

        if (newIngredients.length > 0) {
            setIngredients(newIngredients);
            toast.success("Analisis AI selesai! Data bahan baku & overhead telah diisi.");
        } else {
            toast.custom((t) => (
              <div className="bg-[#FFF9E6] border border-[#FFCC80] rounded-lg p-4 flex items-start gap-3 shadow-md w-full max-w-md relative">
                <AlertTriangle className="w-5 h-5 text-[#B45309] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#7A4100]">
                    AI could not detect ingredients. Please input manually.
                  </p>
                </div>
                <button 
                  onClick={() => toast.dismiss(t)} 
                  className="text-[#B45309] hover:text-[#7A4100] transition-colors absolute top-2 right-2"
                >
                  <X size={16} />
                </button>
              </div>
            ), { duration: 5000 });
        }

        if (Array.isArray(result.overhead_suggestions) && result.overhead_suggestions.length > 0) {
            const newFixedCosts = result.overhead_suggestions.map(oh => ({
                id: Math.random().toString(36).substr(2, 9),
                name: oh.name || 'Overhead',
                monthlyCost: oh.estimated_cost || 0
            }));
            setFixedCosts(newFixedCosts);
        }

      }
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      // Show specific message to user
      const errorMsg = error.message || "Terjadi kesalahan saat analisis AI.";
      
      // Custom UI for specific errors
      toast.custom((t) => (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 shadow-lg w-full max-w-md relative">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
                <h4 className="text-sm font-bold text-red-800">Gagal Menganalisis</h4>
                <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
            </div>
            <button onClick={() => toast.dismiss(t)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><X size={16} /></button>
        </div>
      ), { duration: 6000 });

    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCalculate = () => {
    if (!productName) {
        toast.error("Nama produk wajib diisi.");
        return;
    }
    if (totalHPP <= 0) {
        toast.error("Total HPP masih 0. Mohon lengkapi data biaya.");
        return;
    }

    setShowResults(true);
    setSuggestPrice(Math.ceil(totalHPP * 1.5 / 100) * 100);
    
    setTimeout(() => {
        const resultsElement = document.getElementById('results-section');
        if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
  };

  const handleSaveProduct = async () => {
    if (!productName) return;
    setIsSaving(true);
    try {
        let categoryId;
        const { data: catData } = await supabase
            .from('item_categories')
            .select('id')
            .ilike('name', category)
            .maybeSingle();
        
        if (catData) {
            categoryId = catData.id;
        } else {
            const { data: newCat } = await supabase
                .from('item_categories')
                .insert({ name: category })
                .select('id')
                .single();
            categoryId = newCat?.id;
        }

        // Insert with selling_price now enabled
        const { error } = await supabase.from('items').insert({
            name: productName,
            category_id: categoryId,
            unit: 'pcs',
            cost_price: totalHPP,
            selling_price: suggestedPrice, // Enabled
            min_stock: 10,
            is_active: true,
        });

        if (error) throw error;
        toast.success("Produk berhasil disimpan ke database!");

    } catch (error: any) {
        toast.error(`Gagal menyimpan: ${error.message}`);
    } finally {
        setIsSaving(false);
    }
  };

  // --- Manual Price Calculation Logic ---
  const profitNominal = suggestedPrice - totalHPP;
  const profitMargin = suggestedPrice > 0 ? (profitNominal / suggestedPrice) * 100 : 0;
  const isLoss = profitNominal < 0;

  const inputClass = "w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all hover:border-navbar-accent-1/50";
  const labelClass = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-8 pb-24 animate-fade-in">
      <PageHeader title="Kalkulator HPP Otomatis" />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: INPUT FORM */}
        <div className="xl:col-span-7 space-y-8">
          <Card className="p-6 sm:p-8 border-t-4 border-t-navbar-accent-1 shadow-xl shadow-gray-200/50 relative overflow-hidden bg-white">
            
            {/* Glow Effect */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-navbar-accent-1/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 relative z-10 gap-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <Calculator className="w-6 h-6 mr-2 text-navbar-accent-1" />
                    Input Data Produk
                </h3>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold uppercase rounded-full tracking-wide">
                    Model: Retail / F&B
                </span>
            </div>

            {/* Product Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 relative z-10">
                <div className="space-y-1">
                    <label className={labelClass}>Nama Produk <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className={`${inputClass} py-3 text-base font-medium`}
                        placeholder="Contoh: Kopi Susu Gula Aren"
                    />
                </div>
                <div className="space-y-1">
                    <label className={labelClass}>Kategori</label>
                    <div className="relative">
                        <select 
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className={`${inputClass} appearance-none py-3 cursor-pointer`}
                        >
                            <option>Makanan & Minuman</option>
                            <option>Dessert</option>
                            <option>Main Course</option>
                            <option>Bakery</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Image Upload Section - REDESIGNED */}
            <div className="mb-8 relative z-10">
                <label className={labelClass}>Foto Produk (Opsional - Untuk Analisis AI)</label>
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-1 hover:bg-white hover:border-navbar-accent-1 transition-all duration-300">
                    <RawImageUpload 
                        onImageSelected={setProductImage}
                        compact={false}
                        className="bg-transparent border-none"
                        label="Klik untuk upload gambar produk"
                    />
                </div>
                <p className="text-[10px] text-gray-400 mt-2 flex items-center">
                    <ImageIcon className="w-3 h-3 mr-1" />
                    Upload gambar agar AI dapat mendeteksi bahan baku secara visual.
                </p>
            </div>

            {/* AI Trigger Button */}
            <div className="mb-8 relative z-10">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-xl border border-amber-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-lg text-navbar-accent-1 shadow-sm">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800">Bantu Isi Otomatis dengan AI</h4>
                            <p className="text-xs text-gray-600 mt-1 max-w-md">
                                AI akan mengestimasi bahan baku, biaya, dan overhead berdasarkan nama produk dan gambar.
                            </p>
                        </div>
                    </div>
                    <Button 
                        onClick={handleAIAnalysis} 
                        disabled={isAnalyzing || (!productName && !productImage)}
                        className="w-full sm:w-auto whitespace-nowrap shadow-lg shadow-navbar-accent-1/20 bg-navbar-accent-1 hover:bg-navbar-accent-2 text-white border-none py-3 min-w-[160px]"
                    >
                        {isAnalyzing ? (
                          <div className="flex items-center">
                            <Loader2 className="animate-spin w-4 h-4 mr-2" />
                            <span>Memproses...</span>
                          </div>
                        ) : 'Generate Estimasi'}
                    </Button>
                </div>
            </div>

            {/* --- Variable Costs Table (Enhanced) --- */}
            <div className="mb-8 relative z-10">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <h4 className="font-bold text-gray-800 flex items-center gap-2 text-base uppercase tracking-wide">
                            <Package className="w-5 h-5 text-navbar-accent-1" />
                            Biaya Bahan Baku (Variable)
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">Rincikan semua bahan yang digunakan untuk membuat satu produk jadi.</p>
                    </div>
                    <button 
                        type="button"
                        onClick={handleExportExcel}
                        className="flex items-center text-green-600 hover:text-green-700 text-sm font-medium transition-colors cursor-pointer z-20 relative bg-white/50 px-3 py-1.5 rounded-lg hover:bg-green-50"
                        title="Download Excel"
                    >
                        <FileSpreadsheet size={16} className="mr-1.5" />
                        Export .xlsx
                    </button>
                </div>
                
                <div className="space-y-4">
                    {/* Header Desktop - Grouped */}
                    <div className="hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase bg-gray-50/80 p-3 rounded-t-lg border-b border-gray-200">
                        <div className="col-span-3 flex items-end">Bahan</div>
                        <div className="col-span-3 text-center border-l border-gray-200 pl-2">
                            <div className="border-b border-gray-200 pb-1 mb-1 text-gray-400">Pemakaian per Produk</div>
                            <div className="grid grid-cols-2 gap-2">
                                <span>Jml Pakai</span>
                                <span>Satuan</span>
                            </div>
                        </div>
                        <div className="col-span-4 text-center border-l border-gray-200 pl-2">
                            <div className="border-b border-gray-200 pb-1 mb-1 text-gray-400">Info Pembelian Bahan</div>
                            <div className="grid grid-cols-3 gap-2">
                                <span>Total Harga</span>
                                <span>Jml Beli</span>
                                <span>Satuan</span>
                            </div>
                        </div>
                        <div className="col-span-2 text-right flex items-end justify-end border-l border-gray-200 pl-2">Biaya per Produk</div>
                    </div>

                    {ingredients.map((item, idx) => {
                        const calculatedCost = calculateItemCost(item);
                        const hasError = calculatedCost === 'ERROR';

                        return (
                            <div 
                                key={item.id} 
                                className={`
                                    grid grid-cols-1 md:grid-cols-12 gap-3 items-start md:items-center 
                                    bg-white border rounded-xl p-4 md:py-3 md:px-3 relative group animate-fade-in transition-all
                                    ${hasError ? 'border-red-200 bg-red-50/10' : 'border-gray-200 hover:border-navbar-accent-1'}
                                `} 
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                {/* Nama Bahan */}
                                <div className="md:col-span-3">
                                    <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Nama Bahan</label>
                                    <input 
                                        type="text" 
                                        value={item.name}
                                        onChange={(e) => updateIngredient(item.id, 'name', e.target.value)}
                                        placeholder="Contoh: Ayam Utuh"
                                        className={`${inputClass} font-medium w-full border-gray-300 focus:border-navbar-accent-1`}
                                    />
                                </div>
                                
                                {/* Usage (Takaran) */}
                                <div className="md:col-span-3 grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Jml Pakai</label>
                                        <input 
                                            type="number" 
                                            value={item.usageQty || ''}
                                            onChange={(e) => updateIngredient(item.id, 'usageQty', parseFloat(e.target.value))}
                                            placeholder="0"
                                            className={`${inputClass} text-center`}
                                        />
                                    </div>
                                    <div className="relative">
                                        <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Satuan</label>
                                        <select 
                                            value={item.usageUnit}
                                            onChange={(e) => updateIngredient(item.id, 'usageUnit', e.target.value)}
                                            className={`${inputClass} appearance-none cursor-pointer bg-white`}
                                        >
                                            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none md:top-1/2 md:mt-0 mt-3" />
                                    </div>
                                </div>

                                {/* Buy Info (Harga Beli) */}
                                <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div className="md:col-span-1">
                                        <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Total Harga</label>
                                        <input 
                                            type="number" 
                                            value={item.buyPrice || ''}
                                            onChange={(e) => updateIngredient(item.id, 'buyPrice', parseFloat(e.target.value))}
                                            placeholder="Rp 0"
                                            className={`${inputClass} text-right md:text-center`}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:col-span-2">
                                        <div>
                                            <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Jml Beli</label>
                                            <input 
                                                type="number" 
                                                value={item.buyQty || ''}
                                                onChange={(e) => updateIngredient(item.id, 'buyQty', parseFloat(e.target.value))}
                                                className={`${inputClass} text-center`}
                                            />
                                        </div>
                                        <div className="relative">
                                            <label className="md:hidden text-xs font-bold text-gray-500 mb-1 block">Satuan Beli</label>
                                            <select 
                                                value={item.buyUnit}
                                                onChange={(e) => updateIngredient(item.id, 'buyUnit', e.target.value)}
                                                className={`${inputClass} appearance-none cursor-pointer bg-white`}
                                            >
                                                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none md:top-1/2 md:mt-0 mt-3" />
                                        </div>
                                    </div>
                                </div>

                                {/* Cost & Action */}
                                <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-2 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
                                    <span className="md:hidden text-xs font-bold text-gray-500">Biaya per Produk:</span>
                                    
                                    {hasError ? (
                                        <div className="flex items-center justify-center bg-red-100 text-red-700 px-3 py-2 rounded-lg text-xs font-bold w-full md:w-auto animate-pulse">
                                            <AlertCircle className="w-3 h-3 mr-1.5" />
                                            Error Unit
                                        </div>
                                    ) : (
                                        <div className="bg-gray-100/50 px-3 py-2 rounded-lg w-full md:w-auto text-right">
                                            <span className="font-bold text-gray-900 text-sm">
                                                {Math.round(calculatedCost as number).toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    )}

                                    <button 
                                        onClick={() => handleRemoveIngredient(item.id)}
                                        className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors ml-1"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    
                    <button 
                        onClick={handleAddIngredient}
                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center text-sm font-bold text-gray-500 hover:text-navbar-accent-1 hover:border-navbar-accent-1 hover:bg-amber-50/30 transition-all group"
                    >
                        <Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" /> Tambah Bahan Baku
                    </button>
                </div>
            </div>

            {/* Fixed Costs Section */}
            <div className="mb-8 relative z-10">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center text-sm uppercase tracking-wide">
                    <Zap className="w-4 h-4 mr-2 text-navbar-accent-1" />
                    Biaya Operasional (Overhead)
                </h4>
                
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm hidden sm:block">
                        <Target className="w-5 h-5" />
                    </div>
                    <div className="flex-grow w-full">
                        <label className="text-xs font-bold text-blue-800 uppercase mb-1 block">Target Penjualan Bulanan</label>
                        <div className="flex items-center">
                            <input 
                                type="number" 
                                value={targetSales}
                                onChange={(e) => setTargetSales(Math.max(1, parseFloat(e.target.value) || 0))}
                                className="w-full sm:w-32 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <span className="ml-2 text-xs font-bold text-blue-600 whitespace-nowrap">Unit / Porsi</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {isAnalyzing ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="h-10 flex-grow rounded-lg" />
                                    <Skeleton className="h-10 w-40 rounded-lg" />
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        fixedCosts.map((item) => (
                            <div key={item.id} className="flex flex-col sm:flex-row items-center gap-3 group bg-white p-3 rounded-xl border border-gray-200 sm:border-transparent sm:bg-transparent sm:p-0">
                                <input 
                                    type="text" 
                                    value={item.name}
                                    onChange={(e) => updateFixedCost(item.id, 'name', e.target.value)}
                                    className={`${inputClass} flex-grow bg-gray-50 focus:bg-white`}
                                    placeholder="Nama Biaya"
                                />
                                <div className="flex items-center w-full sm:w-auto gap-2">
                                    <div className="relative flex-grow sm:w-40">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">Rp</span>
                                        <input 
                                            type="number" 
                                            value={item.monthlyCost || ''}
                                            onChange={(e) => updateFixedCost(item.id, 'monthlyCost', e.target.value)}
                                            className={`${inputClass} pl-8 text-right font-medium`}
                                            placeholder="0"
                                        />
                                    </div>
                                    <button onClick={() => handleRemoveFixedCost(item.id)} className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    
                    {!isAnalyzing && (
                        <button 
                            onClick={handleAddFixedCost}
                            className="w-full sm:w-auto text-xs font-bold text-navbar-accent-1 hover:text-navbar-accent-2 mt-2 flex items-center justify-center sm:justify-start py-2"
                        >
                            <Plus className="w-4 h-4 mr-1" /> Tambah Biaya Lain
                        </button>
                    )}
                </div>
            </div>

            {/* Main Action Button */}
            <div className="sticky bottom-6 z-20">
                <Button 
                    onClick={handleCalculate}
                    variant="primary"
                    className="w-full py-4 text-lg font-bold shadow-2xl shadow-navbar-accent-1/40 hover:scale-[1.02] hover:-translate-y-1 transition-all bg-gradient-to-r from-navbar-accent-1 to-navbar-accent-2 border-none text-navbar-background rounded-xl flex items-center justify-center"
                >
                    Hitung HPP & Saran Harga
                </Button>
            </div>

          </Card>
        </div>

        {/* RIGHT COLUMN: RESULTS (Sticky) */}
        <div className="xl:col-span-5" id="results-section">
            <div className={`sticky top-24 transition-all duration-700 ease-out ${showResults ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-8 pointer-events-none filter grayscale blur-sm hidden xl:block'}`}>
                <Card className="bg-white border border-gray-100 shadow-2xl relative overflow-hidden rounded-3xl">
                    
                    {/* Header Result */}
                    <div className="bg-gray-900 p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-navbar-accent-1/20 rounded-full blur-3xl -mr-10 -mt-10 animate-pulse"></div>
                        <h3 className="text-xl font-bold relative z-10 flex items-center">
                            <DollarSign className="w-6 h-6 mr-2 text-navbar-accent-1" />
                            Analisis Profitabilitas
                        </h3>
                        <p className="text-gray-400 text-sm mt-1 relative z-10">Estimasi biaya & margin keuntungan</p>
                    </div>

                    <div className="p-6 space-y-8">
                        
                        {/* Total HPP Display */}
                        <div className="text-center relative">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total HPP per Unit</p>
                            <div className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight break-words">
                                <span className="text-xl sm:text-2xl text-gray-400 align-top mr-1">Rp</span>
                                {Math.round(totalHPP).toLocaleString('id-ID')}
                            </div>
                            
                            <div className="mt-6 grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase">Variable Cost</p>
                                    <p className="text-base sm:text-lg font-bold text-blue-700">Rp {Math.round(totalVariableCost).toLocaleString('id-ID')}</p>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                    <p className="text-[10px] font-bold text-purple-400 uppercase">Fixed Cost</p>
                                    <p className="text-base sm:text-lg font-bold text-purple-700">Rp {Math.round(fixedCostPerUnit).toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gray-100 w-full"></div>

                        {/* Pricing Suggestions Cards */}
                        <div>
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center text-sm uppercase tracking-wide">
                                <Sparkles className="w-4 h-4 mr-2 text-navbar-accent-1" />
                                Rekomendasi Harga Jual
                            </h4>

                            <div className="space-y-4">
                                {/* Competitive */}
                                <div className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100 transition-all cursor-pointer relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Kompetitif</span>
                                            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                                                Rp {(Math.ceil(totalHPP * 1.3 / 100) * 100).toLocaleString('id-ID')}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs text-gray-400">Margin</span>
                                            <span className="block text-lg font-bold text-blue-600">30%</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-50 mt-2">
                                        <span>Profit Bersih:</span>
                                        <span className="font-bold text-green-600">+ Rp {Math.round((Math.ceil(totalHPP * 1.3 / 100) * 100) - totalHPP).toLocaleString('id-ID')}</span>
                                    </div>
                                </div>

                                {/* Standard (Recommended) */}
                                <div className="group bg-gradient-to-br from-navbar-accent-1/5 to-transparent border-2 border-navbar-accent-1 rounded-xl p-4 shadow-md relative overflow-hidden transform scale-[1.02]">
                                    <div className="absolute top-0 right-0 bg-navbar-accent-1 text-navbar-background text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                                        RECOMMENDED
                                    </div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-xs font-bold text-navbar-accent-1 uppercase tracking-wider">Standar</span>
                                            <div className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                                                Rp {(Math.ceil(totalHPP * 1.5 / 100) * 100).toLocaleString('id-ID')}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs text-gray-500">Margin</span>
                                            <span className="block text-xl font-bold text-navbar-accent-1">50%</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-600 pt-2 border-t border-navbar-accent-1/20 mt-2">
                                        <span>Profit Bersih:</span>
                                        <span className="font-bold text-green-700 text-sm">+ Rp {Math.round((Math.ceil(totalHPP * 1.5 / 100) * 100) - totalHPP).toLocaleString('id-ID')}</span>
                                    </div>
                                </div>

                                {/* Premium */}
                                <div className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-100 transition-all cursor-pointer relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Premium</span>
                                            <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                                                Rp {(Math.ceil(totalHPP * 2.0 / 100) * 100).toLocaleString('id-ID')}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs text-gray-400">Margin</span>
                                            <span className="block text-lg font-bold text-purple-600">100%</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-50 mt-2">
                                        <span>Profit Bersih:</span>
                                        <span className="font-bold text-green-600">+ Rp {Math.round((Math.ceil(totalHPP * 2.0 / 100) * 100) - totalHPP).toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Custom Target Input */}
                        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 shadow-lg overflow-hidden relative">
                            <div className="h-1.5 w-full bg-gradient-to-r from-navbar-accent-1 to-navbar-accent-2"></div>
                            
                            <div className="p-5">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center text-sm uppercase tracking-wide">
                                    <Wallet className="w-4 h-4 mr-2 text-navbar-accent-1" />
                                    Set Harga Manual & Cek Profit
                                </h4>

                                <div className="flex flex-col xl:flex-row gap-6">
                                    {/* Input Section */}
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Harga Jual Anda</label>
                                        <div className="relative group">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg group-focus-within:text-navbar-accent-1 transition-colors">Rp</span>
                                            <input 
                                                type="number" 
                                                value={suggestedPrice || ''}
                                                onChange={(e) => setSuggestPrice(parseFloat(e.target.value))}
                                                placeholder="0"
                                                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-300 rounded-xl font-bold text-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1 focus:border-navbar-accent-1 transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Results Grid */}
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        {/* Net Profit Box */}
                                        <div className={`p-3 rounded-xl border ${isLoss ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} flex flex-col justify-center`}>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isLoss ? 'text-red-600' : 'text-green-600'}`}>
                                                Profit Bersih (Nominal)
                                            </span>
                                            <div className={`text-lg font-bold ${isLoss ? 'text-red-700' : 'text-green-700'} flex items-center`}>
                                                {isLoss ? <TrendingDown className="w-4 h-4 mr-1" /> : <TrendingUp className="w-4 h-4 mr-1" />}
                                                Rp {Math.abs(profitNominal).toLocaleString('id-ID')}
                                            </div>
                                        </div>

                                        {/* Margin Box */}
                                        <div className={`p-3 rounded-xl border ${isLoss ? 'bg-red-50 border-red-200' : 'bg-navbar-accent-1/10 border-navbar-accent-1/30'} flex flex-col justify-center`}>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isLoss ? 'text-red-600' : 'text-navbar-accent-1'}`}>
                                                Margin Profit (%)
                                            </span>
                                            <div className={`text-lg font-bold ${isLoss ? 'text-red-700' : 'text-navbar-accent-1'}`}>
                                                {profitMargin.toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isLoss && (
                                    <div className="mt-4 flex items-start gap-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <p>Harga jual ini di bawah HPP. Anda akan mengalami kerugian sebesar <strong>Rp {Math.abs(profitNominal).toLocaleString('id-ID')}</strong> per unit.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Save Action */}
                        <Button 
                            onClick={handleSaveProduct} 
                            disabled={isSaving}
                            className="w-full py-3 bg-gray-900 hover:bg-black text-white shadow-lg flex justify-center items-center rounded-xl"
                        >
                            {isSaving ? <Spinner size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Simpan ke Database</>}
                        </Button>

                    </div>
                </Card>
            </div>
        </div>

      </div>
    </div>
  );
};

export default HPPCalculatorPage;
