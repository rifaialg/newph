import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Spinner from '../ui/Spinner';
import { Bot, Eye, EyeOff, Key } from 'lucide-react';

const OpenAIConfig: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Load API Key and Status from localStorage on mount
    const storedKey = localStorage.getItem('openai_api_key');
    const activeProvider = localStorage.getItem('active_ai_provider');
    
    if (storedKey) {
      setApiKey(storedKey);
      setIsSaved(true);
    }
    
    if (activeProvider === 'openai') {
      setIsActive(true);
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      toast.error('Please enter a valid API Key.');
      return;
    }

    setIsLoading(true);
    
    // Simulate a validation/saving delay
    setTimeout(() => {
      localStorage.setItem('openai_api_key', apiKey.trim());
      setIsLoading(false);
      setIsSaved(true);
      toast.success('OpenAI API Key saved successfully!');
      
      // Auto-activate if no other provider is active
      if (!localStorage.getItem('active_ai_provider')) {
        handleToggleActive();
      }
    }, 800);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to remove the API Key?')) {
      localStorage.removeItem('openai_api_key');
      setApiKey('');
      setIsSaved(false);
      if (isActive) handleToggleActive(); // Deactivate if removing key
      toast.info('API Key removed.');
    }
  };

  const handleToggleActive = () => {
    if (!isSaved && !apiKey) {
      toast.error('Please save a valid API Key first.');
      return;
    }

    const newState = !isActive;
    setIsActive(newState);

    if (newState) {
      localStorage.setItem('active_ai_provider', 'openai');
      toast.success('OpenAI is now the active AI provider.');
      // Dispatch event to notify other components (like DeepSeekConfig)
      window.dispatchEvent(new Event('ai-provider-changed'));
    } else {
      localStorage.removeItem('active_ai_provider');
      toast.info('AI provider deactivated.');
    }
  };

  // Listen for changes from other components
  useEffect(() => {
    const handleProviderChange = () => {
      const currentProvider = localStorage.getItem('active_ai_provider');
      if (currentProvider !== 'openai' && isActive) {
        setIsActive(false);
      }
    };

    window.addEventListener('ai-provider-changed', handleProviderChange);
    return () => window.removeEventListener('ai-provider-changed', handleProviderChange);
  }, [isActive]);

  return (
    <Card className={`border transition-all duration-300 ${isActive ? 'border-green-500 shadow-md bg-green-50/30' : 'border-gray-100'}`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl border hidden sm:block transition-colors ${isActive ? 'bg-green-100 border-green-200' : 'bg-gray-100 border-gray-200'}`}>
          <Bot className={`w-6 h-6 ${isActive ? 'text-green-600' : 'text-gray-500'}`} />
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                OpenAI (GPT-4o)
                {isActive && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">
                    Active
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Industry-leading reasoning and vision capabilities. Best for image analysis.
              </p>
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={handleToggleActive}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-navbar-accent-1 focus:ring-offset-2
                ${isActive ? 'bg-green-500' : 'bg-gray-200'}
              `}
              role="switch"
              aria-checked={isActive}
            >
              <span className="sr-only">Use OpenAI</span>
              <span
                aria-hidden="true"
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                  ${isActive ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>

          <form onSubmit={handleSave} className="mt-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="openaiApiKey" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  API Key
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-gray-400 group-focus-within:text-navbar-accent-1 transition-colors" />
                  </div>
                  <input
                    id="openaiApiKey"
                    type={isVisible ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (isSaved) setIsSaved(false);
                    }}
                    placeholder="sk-..."
                    className="w-full pl-10 pr-12 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all shadow-sm disabled:bg-gray-50 disabled:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsVisible(!isVisible)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    title={isVisible ? "Hide API Key" : "Show API Key"}
                  >
                    {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                {apiKey && (
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleClear}
                    className="bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-100"
                  >
                    Remove Key
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={isLoading || !apiKey} 
                  variant="primary" 
                  className="shadow-lg shadow-navbar-accent-1/20 min-w-[100px]"
                >
                  {isLoading ? <Spinner size="sm" /> : (isSaved ? 'Update Key' : 'Save Configuration')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Card>
  );
};

export default OpenAIConfig;
