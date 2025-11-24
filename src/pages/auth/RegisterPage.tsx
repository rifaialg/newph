import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';

const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'manager' | 'owner'>('staff');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        toast.success('Registration successful! Please check your email to verify your account.');
      }

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
          <img src="https://i.imgur.com/DOjWG8r.png" alt="ARTIRASA Logo" className="w-12 h-12 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Account</h1>
        <p className="text-gray-500 mt-2 text-sm">Join the team</p>
      </div>
      
      <form className="space-y-5" onSubmit={handleRegister}>
        <Input 
          id="fullName" 
          label="Full Name" 
          type="text" 
          placeholder="John Doe" 
          required 
          value={fullName} 
          onChange={(e) => setFullName(e.target.value)}
          className="bg-gray-50 border-gray-200 focus:bg-white"
        />
        <Input 
          id="email" 
          label="Email Address" 
          type="email" 
          placeholder="you@example.com" 
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
        <Select 
          id="role" 
          label="Role" 
          value={role} 
          onChange={(e) => setRole(e.target.value as any)}
          className="bg-gray-50 border-gray-200 focus:bg-white"
        >
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </Select>
        
        <div className="pt-2">
          <Button type="submit" disabled={loading} className="w-full py-3 text-base shadow-lg shadow-navbar-accent-1/20">
            {loading ? <Spinner /> : 'Sign Up'}
          </Button>
        </div>
      </form>
      
      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/auth/login" className="font-semibold text-navbar-accent-1 hover:text-navbar-accent-2 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default RegisterPage;
