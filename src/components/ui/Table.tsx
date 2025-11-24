import React, { ReactNode } from 'react';
import Spinner from './Spinner';

interface TableProps {
  headers: string[];
  children: ReactNode;
  loading?: boolean;
  emptyStateMessage?: string;
}

const Table: React.FC<TableProps> = ({ headers, children, loading, emptyStateMessage = "No data found." }) => {
  const hasContent = React.Children.count(children) > 0;

  return (
    <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600">
          <thead className="text-xs font-bold text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="px-6 py-4 tracking-wider">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="text-center p-12">
                  <div className="flex justify-center items-center">
                    <Spinner color="primary" size="lg" />
                  </div>
                </td>
              </tr>
            ) : hasContent ? (
              children
            ) : (
              <tr>
                <td colSpan={headers.length} className="text-center p-12 text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="bg-gray-100 p-3 rounded-full mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                    <p>{emptyStateMessage}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Table;
