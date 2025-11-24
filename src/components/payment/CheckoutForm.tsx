import React, { useState } from 'react';
import { ShoppingBag, CheckCircle, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

interface CheckoutFormProps {
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  description: string;
  onSuccess: (paymentRef?: string) => Promise<void>;
  onCancel: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({
  items,
  totalAmount,
  description,
  onSuccess,
  onCancel
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirmOrder = async () => {
    setIsLoading(true);
    try {
      // Simulasi proses order internal
      const orderRef = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Langsung panggil onSuccess karena pembayaran manual/internal
      await onSuccess(orderRef);
      
    } catch (err: any) {
      console.error("Order Error:", err);
      toast.error("Gagal memproses pesanan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Order Summary Section */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
        <div className="flex items-center mb-4">
          <ShoppingBag className="w-5 h-5 text-navbar-accent-1 mr-2" />
          <h3 className="font-bold text-gray-800">Ringkasan Pesanan</h3>
        </div>
        
        <div className="text-sm text-gray-500 mb-4 italic">
          {description}
        </div>
        
        <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">{item.quantity}x</span> {item.name}
              </span>
              <span className="font-medium text-gray-900">
                Rp {(item.price * item.quantity).toLocaleString('id-ID')}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 mt-4 pt-4 flex justify-between items-center">
          <span className="font-bold text-gray-700">Total Tagihan</span>
          <span className="font-bold text-xl text-navbar-accent-1">
            Rp {totalAmount.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-blue-700 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          Pesanan ini akan dicatat sebagai <strong>Distribusi Internal</strong>. Stok akan otomatis dikurangi dari gudang utama.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button 
          variant="secondary" 
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"
        >
          Batal
        </Button>
        <Button 
          variant="primary" 
          onClick={handleConfirmOrder}
          disabled={isLoading}
          className="flex-[2] shadow-lg shadow-navbar-accent-1/20 flex justify-center items-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Memproses...
            </>
          ) : (
            <>
              Konfirmasi Pesanan <ArrowRight className="ml-2" size={18} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default CheckoutForm;
