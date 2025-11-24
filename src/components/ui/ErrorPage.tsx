import React from 'react';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';
import Button from './Button';

interface ErrorPageProps {
  onRetry?: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ onRetry }) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        
        {/* Icon */}
        <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Oops! Something went wrong.
        </h1>

        {/* Description */}
        <p className="text-gray-500 mb-6">
          Something went wrong during code generation. Please try again or check your request.
        </p>

        {/* Terminal Log Style */}
        <div className="bg-slate-900 rounded-lg p-4 mb-8 text-left overflow-hidden shadow-inner border border-slate-800">
          <div className="flex items-center gap-2 mb-2 border-b border-slate-700 pb-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-mono">System Log</span>
          </div>
          <div className="font-mono text-sm">
            <div className="flex items-center text-red-500">
              <span className="mr-2">{'>'}</span>
              <span>Error: Terminal Disconnected</span>
            </div>
            <div className="flex items-center text-red-500 mt-1">
              <span className="mr-2">{'>'}</span>
              <span className="animate-pulse">_</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleRetry} 
          variant="primary" 
          className="w-full py-3 flex items-center justify-center shadow-lg shadow-navbar-accent-1/20 hover:shadow-navbar-accent-1/40"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>

      </div>
    </div>
  );
};

export default ErrorPage;
