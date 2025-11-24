import React, { useState, FormEvent } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Spinner from '../ui/Spinner';

type AdjustmentType = 'credit' | 'debit';

export interface ManualAdjustmentFormData {
  type: AdjustmentType;
  amount: number;
  reason: string;
}

interface ManualAdjustmentFormProps {
  onSubmit: (data: ManualAdjustmentFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const ManualAdjustmentForm: React.FC<ManualAdjustmentFormProps> = ({ onSubmit, onCancel, isSubmitting = false }) => {
  const [type, setType] = useState<AdjustmentType>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});

  const validate = (): boolean => {
    const newErrors: { amount?: string; reason?: string } = {};
    const numericAmount = parseFloat(amount);

    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      newErrors.amount = 'Amount must be greater than 0.';
    }
    if (!reason.trim()) {
      newErrors.reason = 'Reason is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        type,
        amount: parseFloat(amount),
        reason,
      });
    }
  };

  const inputClass = "mt-1 block w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 sm:text-sm transition-all duration-200";

  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="type" className="block text-sm font-semibold text-gray-700">
            Adjustment Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as AdjustmentType)}
            className={inputClass}
            disabled={isSubmitting}
          >
            <option value="credit">Credit (Add Value)</option>
            <option value="debit">Debit (Subtract Value)</option>
          </select>
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-semibold text-gray-700">
            Amount
          </label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-gray-500 sm:text-sm">Rp</span>
            </div>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`${inputClass} pl-10`}
              disabled={isSubmitting}
            />
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-semibold text-gray-700">
            Reason
          </label>
          <textarea
            id="reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Justification for this adjustment..."
            className={inputClass}
            disabled={isSubmitting}
          />
          {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || !amount || !reason} className="shadow-lg shadow-navbar-accent-1/20">
            {isSubmitting ? <Spinner /> : 'Submit Adjustment'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ManualAdjustmentForm;
