import Tesseract from 'tesseract.js';
import { preprocessImage } from '../utils/imageProcessing';

// Updated Interface with Optional Fields
export interface ParsedLineItem {
  name?: string;
  sku?: string;
  quantity?: number;
  unit?: string;
  price?: number;        // Harga Beli
  selling_price?: number; // Harga Jual
  category?: string;     // Nama Kategori (dari OCR/Excel)
  category_id?: number;  // ID Kategori (untuk mapping sistem)
  min_stock?: number;
  total?: number;
  confidence?: number;
}

export interface OCRResult {
  rawText: string;
  items: ParsedLineItem[];
}

// Helper untuk membersihkan string harga (Rp 15.000 -> 15000)
const parsePrice = (str: string): number => {
  if (!str) return 0;
  const clean = str.replace(/[Rp\s]/gi, '');
  
  if (clean.includes(',') && clean.indexOf(',') > clean.lastIndexOf('.')) {
      return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  } else if (clean.includes('.') && clean.indexOf('.') > clean.lastIndexOf(',')) {
      return parseFloat(clean.replace(/,/g, ''));
  } else {
      return parseFloat(clean.replace(/[^0-9]/g, ''));
  }
};

// Helper untuk mendeteksi baris yang tidak relevan (Noise Filtering)
const isIgnoredLine = (line: string): boolean => {
  const lower = line.toLowerCase();
  const ignoredKeywords = [
    'total', 'subtotal', 'sub total', 'kembali', 'tunai', 'cash', 'change', 
    'telp', 'jl.', 'jalan', 'terima kasih', 'thank you', 'reg', 
    'pos', 'tax', 'pajak', 'diskon', 'discount',
    'kasir', 'shift', 'struk', 'receipt'
  ];
  return ignoredKeywords.some(keyword => lower.includes(keyword)) || line.length < 3 || /^[^a-zA-Z0-9]+$/.test(line);
};

// Helper to clean product name
const cleanProductName = (name: string): string => {
    // Remove common prefixes often found in OCR lines
    let clean = name.replace(/^(item|produk|barang|nama|desc|description)\s?[:.]?\s?/i, '');
    clean = clean.replace(/^\d+[\.\)]\s*/, ''); // Remove leading numbers like "1."
    clean = clean.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''); // Remove special chars
    return clean.trim();
};

/**
 * Fungsi Utama Parsing Teks Struk (Advanced Regex)
 */
const parseReceiptText = (text: string): ParsedLineItem[] => {
  const lines = text.split('\n');
  const items: ParsedLineItem[] = [];

  // Regex Patterns
  const qtyPricePattern = /(\d+)\s*[xX]\s*([0-9.,]+)/; 
  const endPricePattern = /\s((?:Rp\.?\s?)?[0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?)$/i;
  const startQtyPattern = /^(\d+)\s+([a-zA-Z]+)/;
  
  // NEW: Specific Keyword Pattern (Requested)
  // Mencari baris yang diawali: "Nama Barang:", "Produk:", "Item:", dll.
  const keywordPattern = /^(?:nama\s+)?(?:produk|item|barang|desc|description)\s*[:.]?\s*(.*)$/i;

  for (const line of lines) {
    const cleanLine = line.trim();
    if (isIgnoredLine(cleanLine)) continue;

    let name = cleanLine;
    let quantity = 1;
    let unit = 'pcs';
    let price = 0;
    let total = 0;
    let isKeywordMatch = false;

    // Strategy 0: Keyword Extraction (Highest Priority)
    const keywordMatch = cleanLine.match(keywordPattern);
    if (keywordMatch && keywordMatch[1].trim().length > 2) {
        name = keywordMatch[1].trim();
        isKeywordMatch = true;
        // Coba cari harga di baris yang sama jika ada angka di ujung
        const priceMatch = name.match(endPricePattern);
        if (priceMatch) {
            price = parsePrice(priceMatch[1]);
            name = name.substring(0, name.length - priceMatch[1].length).trim();
        }
    } 
    else {
        // Strategy 1: Look for "Qty x Price" pattern
        const qtyMatch = cleanLine.match(qtyPricePattern);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[1]);
          price = parsePrice(qtyMatch[2]);
          name = name.replace(qtyMatch[0], '').trim();
        } else {
          // Strategy 2: Look for Price at the end
          const priceMatch = cleanLine.match(endPricePattern);
          if (priceMatch) {
            const priceString = priceMatch[1];
            const parsedVal = parsePrice(priceString);
            
            name = name.substring(0, name.length - priceString.length).trim();
            
            const startQtyMatch = name.match(startQtyPattern);
            if (startQtyMatch) {
                quantity = parseInt(startQtyMatch[1]);
                name = name.substring(startQtyMatch[1].length).trim();
                if (quantity > 0 && parsedVal > 0) {
                    total = parsedVal;
                    price = total / quantity;
                }
            } else {
                quantity = 1;
                price = parsedVal;
            }
          }
        }
    }

    // Final Cleanup
    name = cleanProductName(name);

    // Validation
    if (name.length > 2 && /[a-zA-Z]/.test(name)) {
      items.push({
        name,
        quantity,
        unit,
        price,
        selling_price: undefined,
        sku: undefined,
        category: undefined,
        min_stock: 10, 
        total: total || (quantity * price),
        confidence: isKeywordMatch ? 0.95 : (price > 0 ? 0.9 : 0.5)
      });
    }
  }

  return items;
};

export const processInvoiceImage = async (
  file: File, 
  onProgress: (status: string, progress: number) => void
): Promise<OCRResult> => {
  let worker: Tesseract.Worker | null = null;

  try {
    onProgress('Mengoptimalkan gambar (Preprocessing)...', 10);
    
    const processingPromise = preprocessImage(file);
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error("Preprocessing timeout")), 10000)
    );

    const processedImage = await Promise.race([processingPromise, timeoutPromise]);
    
    onProgress('Memuat engine OCR...', 30);
    
    worker = await Tesseract.createWorker('ind', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          const p = 30 + (m.progress * 60);
          onProgress(`Membaca teks... ${Math.round(m.progress * 100)}%`, p);
        }
      }
    });
    
    const { data: { text } } = await worker.recognize(processedImage);
    
    await worker.terminate();
    worker = null;

    onProgress('Menganalisis data (Smart Keyword Search)...', 95);
    
    const items = parseReceiptText(text);
    
    onProgress('Selesai!', 100);

    return {
      rawText: text,
      items,
    };

  } catch (error: any) {
    console.error("OCR Process Error:", error);
    if (worker) {
      await (worker as Tesseract.Worker).terminate();
    }
    throw new Error(error.message || "Gagal memproses nota.");
  }
};
