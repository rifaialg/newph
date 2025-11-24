import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const sessionSchema = z.object({
  // Simplified schema as location is removed
  notes: z.string().optional(),
});

type SessionFormData = z.infer<typeof sessionSchema>;

interface CreateSessionModalProps {
  onSuccess: () => void;
}

const CreateSessionModal: React.FC<CreateSessionModalProps> = ({ onSuccess }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
  });

  const onSubmit = async (data: SessionFormData) => {
    try {
      // 1. Create the session record
      const { data: sessionData, error: sessionError } = await supabase
        .from('stock_opname_sessions')
        .insert({})
        .select('id')
        .single();
      
      if (sessionError) throw sessionError;
      
      // 2. Call RPC to snapshot stock (Updated RPC to not require location)
      const { error: snapshotError } = await supabase.rpc('snapshot_stock_for_opname', {
        opname_session_id: sessionData.id,
        // location_ids parameter removed or passed as null/empty in updated RPC
      });

      if (snapshotError) throw snapshotError;

      toast.success('New opname session created successfully.');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 mb-4">
          This will create a new stock opname session for all items in the inventory.
          Current system stock will be recorded as the baseline.
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
        <textarea
          {...register('notes')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-navbar-accent-1"
          rows={3}
          placeholder="e.g. Monthly stock count"
        />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="submit" disabled={isSubmitting} variant="primary">
          {isSubmitting ? <Spinner /> : 'Start Opname Session'}
        </Button>
      </div>
    </form>
  );
};

export default CreateSessionModal;
