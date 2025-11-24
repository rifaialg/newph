import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

type UserRole = 'owner' | 'manager' | 'staff';

interface InviteUserFormProps {
  onSuccess: () => void;
}

const InviteUserForm: React.FC<InviteUserFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = () => {
    if (!email) {
      setError('Email address is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!role) {
      setError('Please select a role.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('invite-user', {
        body: { email, role },
      });

      if (functionError) {
        throw new Error(functionError.message);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      toast.success(`Invitation sent successfully to ${email}`);
      setEmail('');
      setRole('');
      onSuccess();

    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const inputClass = "mt-1 block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 sm:text-sm transition-all duration-200";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
          User's Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          placeholder="user@example.com"
          className={inputClass}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-semibold text-gray-700">
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => { setRole(e.target.value as UserRole); setError(null); }}
          className={inputClass}
          disabled={loading}
        >
          <option value="" disabled>Select Role...</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
      </div>
      
      {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}

      <div className="flex justify-end pt-6 border-t border-gray-100">
        <Button type="submit" disabled={loading} variant="primary" className="w-full sm:w-auto shadow-lg shadow-navbar-accent-1/20">
          {loading ? <Spinner /> : 'Send Invitation'}
        </Button>
      </div>
    </form>
  );
};

export default InviteUserForm;
