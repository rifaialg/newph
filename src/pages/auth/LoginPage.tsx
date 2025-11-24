import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      
      toast.success('Welcome back! Redirecting...');
      navigate('/dashboard');

    } catch (error: any) {
      toast.error(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-8 bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50">
      <div className="text-center">
        <div className="inline-flex justify-center items-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl mb-6 shadow-inner">
          <img src="https://i.imgur.com/DOjWG8r.png" alt="ARTIRASA Logo" className="w-16 h-16 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome Back</h1>
        <p className="text-gray-500 mt-2 text-sm">Sign in to access your inventory dashboard</p>
      </div>
      
      <form className="space-y-6" onSubmit={handleLogin}>
        <div className="space-y-4">
          <Input 
            id="email" 
            label="Email Address" 
            type="email" 
            placeholder="name@artirasa.co.id" 
            required 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="bg-gray-50 border-gray-200 focus:bg-white"
          />
          <Input 
            id="password" 
            label="Password" 
            type="password" 
            placeholder="••••••••" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="bg-gray-50 border-gray-200 focus:bg-white"
          />
        </div>
        
        <div className="pt-2">
          <Button type="submit" disabled={loading} className="w-full py-3 text-base shadow-lg shadow-navbar-accent-1/20">
            {loading ? <Spinner /> : 'Sign In'}
          </Button>
        </div>
      </form>

      <div className="pt-4 text-center">
        <p className="text-xs text-gray-400">
          &copy; 2025 PT Artirasa Cipta Sentosa. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
