import React from 'react';
import ReactECharts from 'echarts-for-react';
import Card from '../ui/Card';
import { SalesDataPoint } from '../../types/outlet';
import { BarChart3, ShoppingBag } from 'lucide-react';
import Skeleton from '../ui/Skeleton';

interface OutletSalesAnalyticsProps {
  data?: SalesDataPoint[];
  loading?: boolean;
}

const OutletSalesAnalytics: React.FC<OutletSalesAnalyticsProps> = ({ data, loading }) => {
  if (loading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  const salesData = data || [];
  const dates = salesData.map(d => new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
  const revenues = salesData.map(d => d.total_sales);
  const transactions = salesData.map(d => d.transaction_count);

  const totalRevenue = revenues.reduce((a, b) => a + b, 0);
  const totalTransactions = transactions.reduce((a, b) => a + b, 0);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['Omzet (Rp)', 'Transaksi'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Omzet',
        axisLabel: { formatter: (val: number) => `${val / 1000}k` },
        splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } }
      },
      {
        type: 'value',
        name: 'Transaksi',
        position: 'right',
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'Omzet (Rp)',
        type: 'bar',
        data: revenues,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#C89A4B' }, // Navbar Accent 1
              { offset: 1, color: '#E1B86B' }  // Navbar Accent 2
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: '40%'
      },
      {
        name: 'Transaksi',
        type: 'line',
        yAxisIndex: 1,
        data: transactions,
        itemStyle: { color: '#3B82F6' },
        smooth: true
      }
    ]
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-navbar-accent-1" />
            Laporan Penjualan
          </h3>
          <p className="text-xs text-gray-500 mt-1">Tren penjualan 7 hari terakhir</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 uppercase font-bold">Total Omzet (7 Hari)</p>
          <p className="text-xl font-bold text-navbar-accent-1">Rp {totalRevenue.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="flex-grow min-h-[300px]">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-xs text-gray-500">Rata-rata Harian</p>
          <p className="font-bold text-gray-800">Rp {Math.round(totalRevenue / 7).toLocaleString('id-ID')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Transaksi</p>
          <p className="font-bold text-gray-800 flex items-center justify-center">
            <ShoppingBag size={14} className="mr-1 text-blue-500" />
            {totalTransactions}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default OutletSalesAnalytics;
