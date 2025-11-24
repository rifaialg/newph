import React from 'react';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, children }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6">
      <h1 className="text-lg md:text-xl font-bold text-gray-800 tracking-tight">{title}</h1>
      {children && <div className="mt-3 md:mt-0">{children}</div>}
    </div>
  );
};

export default PageHeader;
