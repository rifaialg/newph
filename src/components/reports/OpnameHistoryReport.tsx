import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import Table from '../ui/Table';
import { Download } from 'lucide-react';
import Button from '../ui/Button';
import { exportToCsv } from '../../utils/export';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

const OpnameHistoryReport: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_opname_history_report');
      if (error) toast.error(error.message);
      else setData(data);
      setLoading(false);
    };
    fetchReport();
  }, []);

  const handleExport = () => {
    exportToCsv('opname_history_report.csv', data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={handleExport} className="w-full sm:w-auto flex items-center" variant="secondary">
          <Download size={16} className="mr-2" /> Export to CSV
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <Table
          headers={['Session ID', 'Date', 'Status', 'Total Variance', 'Variance Value']}
          loading={loading}
          emptyStateMessage="No opname history found."
        >
          {data.map((row) => (
            <tr key={row.session_id} className="bg-white border-b">
              <td className="px-6 py-4">#{row.session_id}</td>
              <td className="px-6 py-4">{new Date(row.created_at).toLocaleString('id-ID')}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadge(row.status)}`}>
                  {row.status}
                </span>
              </td>
              <td className="px-6 py-4">{row.total_variance}</td>
              <td className="px-6 py-4">Rp {row.total_variance_value.toLocaleString('id-ID')}</td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="block lg:hidden">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        ) : data.length > 0 ? (
          <div className="space-y-4">
            {data.map((row) => (
              <Card key={row.session_id} className="p-4">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-lg text-gray-800">Session #{row.session_id}</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadge(row.status)}`}>
                    {row.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{new Date(row.created_at).toLocaleString('id-ID')}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500">Total Variance</p>
                    <p className="font-semibold text-lg">{row.total_variance}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Variance Value</p>
                    <p className="font-semibold text-lg">Rp {row.total_variance_value.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center p-8 text-gray-500">
            No opname history found.
          </Card>
        )}
      </div>
    </div>
  );
};

export default OpnameHistoryReport;
