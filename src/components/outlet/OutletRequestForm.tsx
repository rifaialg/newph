import React from 'react';
import { Truck, Send } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';

// Placeholder component for Request Form
const OutletRequestForm: React.FC<{ outletId: number }> = ({ outletId }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <Truck className="w-5 h-5 mr-2 text-navbar-accent-1" />
          Permintaan Barang ke Pusat (PH)
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <Card className="p-6">
                <div className="text-center py-10">
                    <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <Send className="text-blue-400" size={32} />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-700">Formulir Permintaan Stok</h4>
                    <p className="text-gray-500 mt-2">
                        Fitur untuk mengajukan restock bahan baku atau produk jadi ke Production House.
                    </p>
                </div>
            </Card>
        </div>
        
        <div>
            <Card className="p-6 bg-gray-50 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4">Status Permintaan Terakhir</h4>
                <div className="space-y-4">
                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-gray-500">REQ-001</span>
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold">Pending</span>
                        </div>
                        <p className="text-sm font-medium">Kopi Arabica, Susu UHT...</p>
                        <p className="text-xs text-gray-400 mt-1">Diajukan: 2 jam lalu</p>
                    </div>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default OutletRequestForm;
