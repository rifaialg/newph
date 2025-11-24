import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Package, DollarSign, MapPin, AlertOctagon } from 'lucide-react'; // Updated icons
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/dashboard/StatCard';
import { DashboardMetrics } from '../../types/database';
import Card from '../../components/ui/Card';
import ReactECharts from 'echarts-for-react';
import Skeleton from '../../components/ui/Skeleton';

const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const [metricsRes, chartRes] = await Promise.all([
        supabase.rpc('get_dashboard_metrics').single(),
        supabase.rpc('get_opname_summary_chart_data'),
      ]);

      if (metricsRes.error) throw metricsRes.error;
      setMetrics(metricsRes.data);

      if (chartRes.error) throw chartRes.error;
      setChartData(chartRes.data);
    } catch (error: any) {
      toast.error(`Failed to refresh dashboard: ${error.message}`);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData(true);

    const channel = supabase
      .channel('dashboard_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_movements' },
        () => {
          fetchData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const formatCurrency = (value: number | undefined | null) => {
    if (typeof value !== 'number') return 'Rp 0';
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  // Modern Bright Chart Options
  const chartOptions = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#E5E7EB',
      textStyle: { color: '#1F2937' },
      axisPointer: { type: 'line', lineStyle: { color: '#E5E7EB', width: 2 } }
    },
    grid: { left: '2%', right: '2%', bottom: '5%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartData.map(d => new Date(d.created_at).toLocaleDateString('id-ID')).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#6B7280',
        fontWeight: 500,
        margin: 14
      }
    },
    yAxis: {
      type: 'value',
      splitLine: { 
        show: true, 
        lineStyle: { type: 'dashed', color: '#F3F4F6' } 
      },
      axisLabel: {
        formatter: (value: number) => `${value / 1000}k`,
        color: '#9CA3AF'
      }
    },
    series: [{
      name: 'Variance Value',
      type: 'bar',
      barWidth: '40%',
      data: chartData.map(d => d.total_variance_value).reverse(),
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#6366F1' }, // Indigo-500
            { offset: 1, color: '#818CF8' }  // Indigo-400
          ]
        },
        borderRadius: [8, 8, 0, 0]
      },
      emphasis: {
        itemStyle: {
          color: '#4F46E5' // Indigo-600 on hover
        }
      }
    }]
  };

  return (
    <div className="space-y-8 pb-8">
      <PageHeader title="Dashboard" />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
        <StatCard 
          title="Total Items" 
          value={metrics?.total_items ?? 0} 
          icon={Package} 
          loading={loading} 
          variant="blue"
        />
        <StatCard 
          title="Total Stock Value" 
          value={formatCurrency(metrics?.total_stock_value)} 
          icon={DollarSign} 
          loading={loading} 
          variant="green"
        />
        <StatCard 
          title="Active Locations" 
          value={metrics?.active_locations ?? 0} 
          icon={MapPin} 
          loading={loading} 
          variant="purple"
        />
        <StatCard 
          title="Low Stock Items" 
          value={metrics?.low_stock_items_count ?? 0} 
          icon={AlertOctagon} 
          loading={loading} 
          variant="red"
        />
      </div>
      
      {/* Chart Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Last 5 Opname Variance</h3>
            <p className="text-sm text-gray-500 mt-1">Financial impact of recent stock adjustments</p>
          </div>
          {/* Optional: Add a filter dropdown or legend here */}
        </div>
        
        {loading ? (
           <div style={{ height: '350px' }} className="w-full bg-gray-50 rounded-xl animate-pulse flex items-center justify-center">
              <Skeleton className="h-full w-full rounded-xl" />
           </div>
        ) : (
          <ReactECharts 
            option={chartOptions} 
            style={{ height: '350px' }} 
            notMerge={true} 
            lazyUpdate={true} 
            theme="light"
          />
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
