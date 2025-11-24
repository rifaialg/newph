import { toast } from 'sonner';
import { processInvoiceImage } from './ocrService'; 

// API Endpoints
// FIX: Updated DeepSeek Endpoint to standard chat completions
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface HPPComponent {
  name: string;
  usage_qty: number;
  usage_unit: string;
  buy_price: number;
  buy_qty: number;
  buy_unit: string;
}

export interface HPPResponse {
  description?: string; 
  ingredients: HPPComponent[];
  packaging: HPPComponent[];
  overhead_suggestions: { name: string; estimated_cost: number }[];
}

export interface InvoiceItem {
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
}

export interface InvoiceAnalysisResponse {
  supplier_name?: string;
  date?: string;
  items: InvoiceItem[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const getActiveProviderConfig = () => {
  const provider = localStorage.getItem('active_ai_provider') || 'deepseek'; 
  let apiKey = '';
  let url = '';
  let model = '';

  if (provider === 'openai') {
    apiKey = localStorage.getItem('openai_api_key') || import.meta.env.VITE_OPENAI_API_KEY || '';
    url = OPENAI_API_URL;
    model = 'gpt-4o'; 
  } else if (provider === 'gemini') {
    apiKey = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
    model = localStorage.getItem('gemini_model') || 'gemini-1.5-flash-latest'; 
    url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  } else {
    // DeepSeek
    apiKey = localStorage.getItem('deepseek_api_key') || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
    url = DEEPSEEK_API_URL;
    model = 'deepseek-chat'; 
  }

  return { provider, apiKey, url, model };
};

// --- GENERIC CHAT FUNCTION ---
export const chatWithAI = async (messages: ChatMessage[]): Promise<string | null> => {
  const { provider, apiKey, url, model } = getActiveProviderConfig();

  if (!apiKey) {
    toast.error(`API Key untuk ${provider.toUpperCase()} belum diatur.`);
    return "Maaf, saya belum bisa menjawab karena API Key belum dikonfigurasi.";
  }

  try {
    let response;
    
    if (provider === 'gemini') {
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })).filter(msg => msg.role !== 'system'); 

      const systemMsg = messages.find(m => m.role === 'system');
      if (systemMsg && contents.length > 0) {
        contents[0].parts[0].text = `${systemMsg.content}\n\n${contents[0].parts[0].text}`;
      }

      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

    } else {
      const payload = {
        model: model,
        messages: messages,
        temperature: 0.7,
      };

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (provider === 'gemini') {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, tidak ada respons.";
    } else {
      return data.choices?.[0]?.message?.content || "Maaf, tidak ada respons.";
    }

  } catch (error: any) {
    console.error('[AI Chat] Error:', error);
    return `Terjadi kesalahan: ${error.message}`;
  }
};

export const generateAIAnalysis = async <T = any>(
  systemPrompt: string,
  imageFile?: File | null
): Promise<T | null> => {
  const { provider, apiKey, url, model } = getActiveProviderConfig();

  if (!apiKey) {
    toast.error(`API Key untuk ${provider.toUpperCase()} tidak ditemukan. Mohon konfigurasi di Settings.`);
    return null;
  }

  try {
    let response;
    
    if (provider === 'deepseek') {
      let content = systemPrompt;

      if (imageFile) {
         try {
             toast.info("DeepSeek Vision: Menganalisis teks dalam gambar...");
             const ocrResult = await processInvoiceImage(imageFile, (status) => {
                 console.log(`[DeepSeek Vision] ${status}`);
             });
             
             if (ocrResult.rawText && ocrResult.rawText.length > 5) {
                 const ocrCleaned = ocrResult.rawText.replace(/\n+/g, ' \n ').substring(0, 3000);
                 content += `\n--- DATA MENTAH DARI GAMBAR (OCR) ---\n"""\n${ocrCleaned}\n"""\nINSTRUKSI KHUSUS OCR: Abaikan noise, perbaiki typo, cari pola item.`;
                 toast.success("Teks berhasil dibaca, AI sedang menganalisis...");
             } else {
                 toast.warning("Gambar tidak mengandung teks yang jelas.");
             }
         } catch (e) {
             console.warn("OCR Vision failed:", e);
             toast.warning("Gagal membaca gambar. Melanjutkan dengan analisis teks standar.");
         }
      }

      const messages = [
        { role: "system", content: "You are an expert Data Entry Specialist & Accountant. You output strictly valid JSON." },
        { role: "user", content: content }
      ];

      const payload = {
        model: model,
        messages: messages,
        temperature: 0.2,
        response_format: { type: "json_object" }
      };

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

    } else if (provider === 'openai') {
      const messages: any[] = [
        { role: "system", content: "You are an expert Data Entry Specialist. Output strictly valid JSON." }
      ];

      if (imageFile) {
        const base64Image = await fileToBase64(imageFile);
        messages.push({
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            { type: "image_url", image_url: { url: base64Image, detail: "high" } }
          ]
        });
      } else {
        messages.push({ role: "user", content: systemPrompt });
      }

      const payload: any = {
        model: model,
        messages: messages,
        temperature: 0.2,
        response_format: { type: "json_object" }
      };

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

    } else if (provider === 'gemini') {
      const parts: any[] = [{ text: systemPrompt }];
      if (imageFile) {
        const base64Image = await fileToBase64(imageFile);
        const base64Data = base64Image.split(',')[1]; 
        parts.push({ inline_data: { mime_type: imageFile.type, data: base64Data } });
      }

      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });
    } else {
        throw new Error("Provider tidak dikenal.");
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error(`API Key ${provider} tidak valid.`);
      if (response.status === 429) throw new Error("Rate limit API terlampaui.");
      throw new Error(errData.error?.message || `API Error: ${response.statusText}`);
    }

    const data = await response.json();
    let textResponse = '';

    if (provider === 'gemini') {
      textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      textResponse = data.choices?.[0]?.message?.content || '';
    }
    
    if (!textResponse) throw new Error("AI tidak memberikan respon teks.");

    const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleanText) as T;
    } catch (e) {
        throw new Error("Gagal membaca format respon dari AI (Invalid JSON).");
    }

  } catch (error: any) {
    console.error('[AI Service] Critical Error:', error);
    // FIX: Better error message for network issues
    if (error.message === 'TypeError: Failed to fetch') {
        throw new Error("Gagal menghubungi server AI. Periksa koneksi internet atau konfigurasi API Key Anda.");
    }
    throw error; 
  }
};

export const generateHPPEstimates = async (
  productName: string, 
  category: string, 
  imageFile?: File | null,
  customPrompt?: string,
  targetSales: number = 1000
): Promise<HPPResponse | null> => {
  const productContext = productName 
    ? `product: "${productName}" (Category: ${category})` 
    : `the product shown in the image (Category: ${category})`;

  const visionInstruction = imageFile 
    ? "1. First, analyze the provided image context (OCR Text or Visual). Identify ingredients listed or implied." 
    : "";

  const prompt = customPrompt || `
    You are an expert F&B Cost Accountant.
    Analyze ${productContext}.
    
    Task:
    ${visionInstruction}
    2. Identify all ingredients required to make this product.
    3. Estimate realistic usage quantity per portion.
    4. Estimate current market buy price (in IDR - Indonesian Rupiah) for each ingredient.
    5. Suggest typical packaging needed.
    6. Estimate monthly overhead costs for a small business (Sales: ${targetSales} units/mo).

    Return STRICT JSON format:
    {
      "description": "Brief analysis of the product...",
      "ingredients": [
        { "name": "Ingredient Name", "usage_qty": number, "usage_unit": "g/ml/pcs", "buy_price": number (IDR), "buy_qty": number, "buy_unit": "kg/l/pcs" }
      ],
      "packaging": [
        { "name": "Packaging Name", "usage_qty": 1, "usage_unit": "pcs", "buy_price": number (IDR), "buy_qty": 50, "buy_unit": "pcs" }
      ],
      "overhead_suggestions": [
        { "name": "Cost Name", "estimated_cost": number (IDR/month) }
      ]
    }
  `;

  return generateAIAnalysis<HPPResponse>(prompt, imageFile);
};

export const analyzeInvoiceImage = async (imageFile: File): Promise<InvoiceAnalysisResponse | null> => {
  const prompt = `
    Anda adalah Asisten Entri Data & Akuntan Ahli untuk bisnis F&B di Indonesia.
    Tugas Anda adalah mengekstrak data dari gambar struk belanja, faktur, atau nota yang diberikan.

    INSTRUKSI UTAMA:
    1. Identifikasi Nama Toko/Supplier dan Tanggal Transaksi jika ada.
    2. Ekstrak daftar barang yang dibeli (Line Items).
    3. Untuk setiap barang, tentukan:
       - Nama Barang: Perbaiki typo OCR. Contoh: "Tpg Terigu" -> "Tepung Terigu", "Bwg Putih" -> "Bawang Putih".
       - Qty (Jumlah): Angka. Jika tidak ada, asumsikan 1.
       - Unit (Satuan): Deteksi satuan (kg, gr, pcs, pack, btl, ikat, ltr, galon). Jika tidak tertulis, tebak berdasarkan konteks.
       - Unit Price (Harga Satuan): Dalam Rupiah (IDR).

    OUTPUT HARUS JSON VALID (tanpa markdown):
    {
      "supplier_name": "Nama Toko atau null",
      "date": "YYYY-MM-DD atau null",
      "items": [
        { "name": "Nama Barang", "qty": 1, "unit": "kg", "unit_price": 15000 }
      ]
    }
  `;

  return generateAIAnalysis<InvoiceAnalysisResponse>(prompt, imageFile);
};
