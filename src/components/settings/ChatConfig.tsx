import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { MessageSquare, Save, RotateCcw, Sparkles } from 'lucide-react';

const DEFAULT_SYSTEM_PROMPT = `Anda adalah Asisten Virtual Cerdas untuk sistem manajemen inventaris "Artirasa". 
Tugas Anda adalah membantu pemilik bisnis dan staf dalam:
1. Memberikan saran bisnis F&B (Food & Beverage).
2. Menjelaskan cara menghitung HPP (Harga Pokok Penjualan).
3. Memberikan ide resep atau variasi menu berdasarkan bahan baku yang umum.
4. Menjawab pertanyaan teknis seputar penggunaan aplikasi ini.

Gunakan bahasa Indonesia yang profesional namun ramah. Jawaban harus ringkas, padat, dan solutif.`;

const ChatConfig: React.FC = () => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const savedPrompt = localStorage.getItem('chatbot_system_prompt');
    setSystemPrompt(savedPrompt || DEFAULT_SYSTEM_PROMPT);
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate delay
    setTimeout(() => {
      localStorage.setItem('chatbot_system_prompt', systemPrompt);
      toast.success('Konfigurasi Chatbot berhasil disimpan!');
      setIsSaving(false);
    }, 600);
  };

  const handleReset = () => {
    if (window.confirm('Kembalikan ke prompt default?')) {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      toast.info('Prompt dikembalikan ke default (Belum disimpan).');
    }
  };

  return (
    <Card className="border border-gray-100 shadow-md">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gradient-to-br from-navbar-accent-1 to-navbar-accent-2 rounded-xl text-white shadow-lg shadow-navbar-accent-1/20 hidden sm:block">
          <MessageSquare className="w-6 h-6" />
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Konfigurasi Chatbot AI
                <Sparkles className="w-4 h-4 text-navbar-accent-1" />
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Atur kepribadian dan pengetahuan dasar asisten virtual Anda.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="systemPrompt" className="block text-sm font-semibold text-gray-700 mb-2">
                System Prompt (Instruksi Dasar)
              </label>
              <div className="relative">
                <textarea
                  id="systemPrompt"
                  rows={8}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 focus:bg-white transition-all resize-y"
                  placeholder="Definisikan bagaimana AI harus berperilaku..."
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-400 pointer-events-none">
                  {systemPrompt.length} karakter
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Tips: Berikan instruksi yang spesifik tentang peran, batasan, dan gaya bahasa yang diinginkan.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleReset}
                className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Reset Default
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving} 
                variant="primary" 
                className="shadow-lg shadow-navbar-accent-1/20 min-w-[120px]"
              >
                {isSaving ? 'Menyimpan...' : <><Save className="w-4 h-4 mr-2" /> Simpan</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChatConfig;
