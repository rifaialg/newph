import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Bot, User, Minimize2, Maximize2 } from 'lucide-react';
import { chatWithAI, ChatMessage } from '../../services/aiService';
import { toast } from 'sonner';

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Halo! Ada yang bisa saya bantu terkait stok atau bisnis hari ini?' }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      // Focus input when opened
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    
    // 1. Update UI immediately
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. Prepare Context (System Prompt + History)
      const systemPrompt = localStorage.getItem('chatbot_system_prompt') || "Anda adalah asisten Artirasa.";
      const contextMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10), // Keep last 10 messages for context window
        userMsg
      ];

      // 3. Call API
      const responseText = await chatWithAI(contextMessages);

      // 4. Update UI with response
      if (responseText) {
        setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
      }
    } catch (error) {
      toast.error("Gagal terhubung ke AI.");
      setMessages(prev => [...prev, { role: 'assistant', content: "Maaf, terjadi kesalahan koneksi. Silakan coba lagi." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Styles ---
  // Gold Gradient for User, Gray for Bot
  const userBubbleClass = "bg-gradient-to-br from-navbar-accent-1 to-navbar-accent-2 text-white rounded-tr-none shadow-md shadow-navbar-accent-1/20";
  const botBubbleClass = "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      
      {/* --- CHAT WINDOW --- */}
      <div 
        className={`
          bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out origin-bottom-right
          ${isOpen ? 'opacity-100 scale-100 mb-4' : 'opacity-0 scale-90 mb-0 pointer-events-none h-0 w-0'}
          ${isMinimized ? 'w-72 h-14' : 'w-[90vw] sm:w-96 h-[500px]'}
        `}
      >
        {/* Header */}
        <div 
          className="bg-gray-900 p-4 flex justify-between items-center cursor-pointer"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-gradient-to-br from-navbar-accent-1 to-navbar-accent-2 rounded-lg shadow-glow-gold">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Artirasa AI
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              </h3>
              {!isMinimized && <p className="text-[10px] text-gray-400">Online • Powered by AI</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-gray-400">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
              className="hover:text-white transition-colors p-1"
            >
              {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="hover:text-red-400 transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body (Messages) */}
        {!isMinimized && (
          <>
            <div className="flex-1 h-[380px] overflow-y-auto p-4 bg-gray-50 custom-scrollbar space-y-4">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Sparkles size={14} className="text-navbar-accent-1" />
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? userBubbleClass : botBubbleClass}`}>
                    {msg.content}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User size={14} className="text-gray-500" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-gray-400" />
                  </div>
                  <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer (Input) */}
            <div className="p-3 bg-white border-t border-gray-100">
              <form onSubmit={handleSend} className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ketik pesan..."
                  className="w-full pl-4 pr-12 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-navbar-accent-1 rounded-xl text-sm focus:ring-2 focus:ring-navbar-accent-1/20 transition-all outline-none"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={`
                    absolute right-2 p-2 rounded-lg transition-all duration-200
                    ${input.trim() && !isLoading 
                      ? 'bg-navbar-accent-1 text-white shadow-md hover:scale-105 active:scale-95' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* --- FLOATING ACTION BUTTON (FAB) --- */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          group relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300
          ${isOpen 
            ? 'bg-gray-800 text-white rotate-90' 
            : 'bg-gradient-to-br from-navbar-accent-1 to-navbar-accent-2 text-white hover:scale-110 hover:shadow-glow-gold'
          }
        `}
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <>
            <MessageSquare size={24} className="relative z-10" />
            {/* Pulse Effect if closed */}
            <span className="absolute inline-flex h-full w-full rounded-full bg-navbar-accent-1 opacity-20 animate-ping -z-0"></span>
          </>
        )}
      </button>
    </div>
  );
};

export default ChatWidget;
