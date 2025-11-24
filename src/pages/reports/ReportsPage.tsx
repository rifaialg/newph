import React from 'react';
import PageHeader from '../../components/ui/PageHeader';
import ProductionHouseView from '../../components/reports/ProductionHouseView';

const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Laporan & Analitik" />
      
      {/* Direct Render of Main Reports View (No more PH/Outlet Toggle) */}
      <ProductionHouseView />
    </div>
  );
};

export default ReportsPage;
