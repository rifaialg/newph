import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Outlet } from '../../types/database';
import PageHeader from '../../components/ui/PageHeader';
import Skeleton from '../../components/ui/Skeleton';
import { Store, MapPin, ArrowRight, Activity, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const OutletSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOutlets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setOutlets(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data outlet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  const handleSelectOutlet = (outletId: number) => {
    navigate(`/outlet/${outletId}/dashboard`);
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in">
      <PageHeader title="Pilih Outlet" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">Selamat Datang di Manajemen Outlet</h2>
          <p className="text-gray-500 mt-2">Silakan pilih cabang outlet untuk mengelola stok, penjualan, dan laporan.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
          </div>
        ) : outlets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outlets.map((outlet) => (
              <div 
                key={outlet.id}
                onClick={() => handleSelectOutlet(outlet.id)}
                className="group relative bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-xl hover:border-navbar-accent-1/50 transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Decorative Header */}
                <div className="h-24 bg-gradient-to-br from-gray-900 to-gray-800 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-navbar-accent-1/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-navbar-accent-1/20 transition-colors"></div>
                  <div className="absolute bottom-4 left-4 flex items-center">
                    <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 text-navbar-accent-1">
                      <Store size={24} />
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-4">
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-navbar-accent-1 transition-colors">
                    {outlet.name}
                  </h3>
                  
                  <div className="mt-3 space-y-2">
                    <div className="flex items-start text-sm text-gray-500">
                      <MapPin size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{outlet.address || 'Alamat belum diatur'}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Activity size={16} className="mr-2 text-green-500" />
                      <span className="text-green-600 font-medium">Status: Operasional</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kelola Cabang</span>
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-navbar-accent-1 group-hover:text-white transition-all">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Belum Ada Outlet</h3>
            <p className="text-gray-500 mt-1 mb-4">Silakan hubungi Administrator untuk menambahkan outlet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutletSelectionPage;
