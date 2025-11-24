import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { OpnameItem, OpnameSession } from '../../types/database';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Card from '../../components/ui/Card';
import { ArrowLeft, CheckCircle, Lock, Search, AlertTriangle } from 'lucide-react';
import Skeleton from '../../components/ui/Skeleton';

const OpnameCountPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<OpnameSession | null>(null);
  const [items, setItems] = useState<OpnameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSessionDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('stock_opname_sessions')
        .select('*')
        .eq('id', id)
        .single();
      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Updated query to remove location dependency
      const { data: itemsData, error: itemsError } = await supabase
        .from('stock_opname_items')
        .select('*, items(name, sku, unit)')
        .eq('session_id', id)
        .order('id'); // Order by ID or Item Name if possible

      if (itemsError) throw itemsError;
      
      // Sort manually if needed since we can't easily order by joined table in simple query without flattening
      const sortedItems = (itemsData as any[]).sort((a, b) => a.items.name.localeCompare(b.items.name));
      setItems(sortedItems);

    } catch (error: any) {
      toast.error(error.message);
      navigate('/opname/sessions');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  const handleCountChange = async (itemId: number, newCount: string) => {
    // Prevent negative input
    if (newCount && parseFloat(newCount) < 0) return;

    const count = newCount === '' ? null : parseFloat(newCount);
    
    // Optimistic UI update
    setItems(prevItems => prevItems.map(item => item.id === itemId ? { ...item, physical_count: count } : item));

    // Debounce or just fire update (Supabase handles concurrency reasonably well for simple updates)
    const { error } = await supabase
      .from('stock_opname_items')
      .update({ physical_count: count })
      .eq('id', itemId);

    if (error) {
      toast.error(`Failed to save count. Please try again.`);
      // Revert logic could be added here if critical
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    
    // Check if all items have counts
    const uncountedItems = items.filter(i => i.physical_count === null);
    if (uncountedItems.length > 0) {
        if (!window.confirm(`Warning: ${uncountedItems.length} items have not been counted (will be treated as no change or 0 depending on logic). Continue?`)) {
            return;
        }
    }

    if (window.confirm('Are you sure you want to approve this session? This will adjust all stock levels and cannot be undone.')) {
      setApproving(true);
      try {
        const { error } = await supabase.rpc('approve_opname_session', { p_session_id: parseInt(id) });
        if (error) throw error;
        toast.success('Session approved and stock levels have been adjusted.');
        fetchSessionDetails();
      } catch (error: any) {
        console.error("Approval error:", error);
        toast.error(`Approval failed: ${error.message}`);
      } finally {
        setApproving(false);
      }
    }
  };
  
  const filteredItems = items.filter(item =>
    item.items.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.items.sku && item.items.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getDiscrepancy = (item: OpnameItem) => {
    if (item.physical_count === null) return 0;
    return item.physical_count - item.system_stock_at_start;
  };

  const getDiscrepancyColor = (discrepancy: number) => {
    if (discrepancy > 0) return 'text-green-600';
    if (discrepancy < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Loading Session..." />
        <Skeleton className="h-24 w-full mb-6" />
        <Skeleton className="h-12 w-full mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Opname Session #${id}`}>
        <Button onClick={() => navigate('/opname/sessions')} variant="secondary" className="w-auto flex items-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700">
          <ArrowLeft size={16} className="mr-2" /> Back to Sessions
        </Button>
      </PageHeader>
      
      <Card className="mb-6 border-l-4 border-l-navbar-accent-1">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <p className="text-gray-600">Date: <span className="font-semibold text-gray-900">{new Date(session?.created_at || '').toLocaleString('id-ID')}</span></p>
            <p className="text-gray-600 mt-1">Status: <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${session?.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{session?.status}</span></p>
          </div>
          {session?.status !== 'approved' ? (
            <Button onClick={handleApprove} disabled={approving} className="w-full md:w-auto mt-4 md:mt-0 flex items-center justify-center shadow-lg shadow-navbar-accent-1/20">
              {approving ? <Spinner /> : <><CheckCircle size={16} className="mr-2" /> Approve Session</>}
            </Button>
          ) : (
            <div className="flex items-center text-green-600 font-semibold mt-4 md:mt-0 bg-green-50 px-4 py-2 rounded-lg border border-green-100">
              <Lock size={16} className="mr-2" /> Session Approved & Locked
            </div>
          )}
        </div>
      </Card>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by item name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 transition-all"
        />
      </div>

      <div className="space-y-4">
        {filteredItems.map(item => {
          const discrepancy = getDiscrepancy(item);
          return (
            <Card key={item.id} className="hover:shadow-md transition-shadow border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                {/* Item Info */}
                <div className="flex-grow mb-4 md:mb-0">
                  <p className="font-bold text-lg text-gray-900">{item.items.name}</p>
                  <p className="text-sm text-gray-500 mt-1 flex items-center">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono mr-2">{item.items.sku || 'No SKU'}</span>
                  </p>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-3 gap-4 w-full md:w-auto">
                  <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">System</p>
                    <p className="text-xl font-semibold text-gray-800">{item.system_stock_at_start} <span className="text-sm font-normal text-gray-500">{item.items.unit}</span></p>
                  </div>
                  <div className="text-center">
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Physical</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.physical_count ?? ''}
                      onChange={(e) => handleCountChange(item.id, e.target.value)}
                      disabled={session?.status === 'approved'}
                      className="w-full p-2 border border-gray-300 rounded-lg text-center text-xl font-bold text-gray-900 focus:ring-2 focus:ring-navbar-accent-1/20 focus:border-navbar-accent-1 disabled:bg-gray-100 disabled:text-gray-500 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div className={`text-center p-3 rounded-lg border ${discrepancy !== 0 ? 'bg-gray-50 border-gray-200' : 'border-transparent'}`}>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Variance</p>
                    <p className={`text-xl font-bold ${getDiscrepancyColor(discrepancy)}`}>
                      {discrepancy > 0 ? '+' : ''}{discrepancy}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  );
};

export default OpnameCountPage;
