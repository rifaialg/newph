import React, { useEffect, useState } from 'react';

export interface InvoiceData {
  referenceNo: string;
  date: string;
  outletName: string;
  type: string;
  dispatcherName: string;
  notes: string;
  paymentMethod?: string;
  items: {
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    price: number;
  }[];
}

interface InvoicePrintProps {
  data: InvoiceData;
  id?: string;
}

const InvoicePrint: React.FC<InvoicePrintProps> = ({ data, id = 'invoice-print-area' }) => {
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const totalAmount = data.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  useEffect(() => {
    // Load company profile from localStorage
    const savedProfile = localStorage.getItem('company_profile');
    if (savedProfile) {
      try {
        setCompanyProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error("Failed to parse company profile", e);
      }
    }
  }, []);

  // Default values if profile not set
  const companyName = companyProfile?.companyName || 'PT ARTIRASA CIPTA SENTOSA';
  const companyAddress = companyProfile?.address || 'Jl. Kemang Raya No. 123, Jakarta Selatan';
  const companyContact = `Phone: ${companyProfile?.phone || '(021) 789-0123'} | Email: ${companyProfile?.email || 'finance@artirasa.co.id'}`;
  const companyLogo = companyProfile?.logoUrl;

  return (
    <div id={id} className="bg-white p-8 max-w-[210mm] mx-auto text-gray-900 font-sans relative print:w-full print:max-w-none" style={{ minHeight: '297mm' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-navbar-accent-1 pb-6 mb-6">
        <div className="flex items-center gap-4">
          {companyLogo ? (
             <img src={companyLogo} alt="Logo" className="w-16 h-16 object-contain rounded-lg" />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-navbar-accent-1 to-navbar-accent-2 rounded-lg flex items-center justify-center text-white font-bold text-2xl shadow-sm print:bg-none print:text-black print:border print:border-black">
                AR
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight uppercase">{companyName}</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-[300px]">{companyAddress}</p>
            <p className="text-sm text-gray-500">{companyContact}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold text-gray-200 uppercase tracking-widest print:text-gray-800">INVOICE</h2>
          <p className="text-sm font-semibold text-navbar-accent-1 mt-1 print:text-black">#{data.referenceNo || 'DRAFT'}</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bill To (Outlet)</h3>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 print:border-gray-300 print:bg-white">
            <p className="text-lg font-bold text-gray-800">{data.outletName}</p>
            <p className="text-sm text-gray-600 mt-1">Internal Distribution</p>
            <p className="text-sm text-gray-600 mt-2"><span className="font-semibold">Type:</span> {data.type}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-gray-100 pb-1">
              <span className="text-sm text-gray-500">Date:</span>
              <span className="text-sm font-semibold text-gray-900">{new Date(data.date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-1">
              <span className="text-sm text-gray-500">Dispatcher:</span>
              <span className="text-sm font-semibold text-gray-900">{data.dispatcherName}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-1">
              <span className="text-sm text-gray-500">Reference:</span>
              <span className="text-sm font-semibold text-gray-900">{data.referenceNo}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-1">
              <span className="text-sm text-gray-500">Payment Method:</span>
              <span className="text-sm font-bold text-navbar-accent-1 uppercase print:text-black">{data.paymentMethod || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-white print:bg-gray-200 print:text-black">
              <th className="py-3 px-4 text-left rounded-tl-lg print:rounded-none">No</th>
              <th className="py-3 px-4 text-left">Item Description</th>
              <th className="py-3 px-4 text-left">SKU</th>
              <th className="py-3 px-4 text-center">Qty</th>
              <th className="py-3 px-4 text-right">Unit Price</th>
              <th className="py-3 px-4 text-right rounded-tr-lg print:rounded-none">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                <td className="py-3 px-4 text-gray-500 font-mono text-xs">{item.sku || '-'}</td>
                <td className="py-3 px-4 text-center font-semibold">{item.quantity} {item.unit}</td>
                <td className="py-3 px-4 text-right text-gray-600">Rp {item.price.toLocaleString('id-ID')}</td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">Rp {(item.quantity * item.price).toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / Totals */}
      <div className="flex justify-end mb-12">
        <div className="w-1/2 space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>Rp {totalAmount.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax (0%)</span>
            <span>Rp 0</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t-2 border-gray-900">
            <span className="text-base font-bold text-gray-900">Grand Total</span>
            <span className="text-xl font-bold text-navbar-accent-1 print:text-black">Rp {totalAmount.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* Notes & Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-auto">
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Notes</h4>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[80px] print:border-gray-300 print:bg-white">
            {data.notes || 'No additional notes.'}
          </p>
        </div>
        <div className="flex flex-col items-center justify-end">
          <div className="h-20 w-full border-b border-gray-300 mb-2"></div>
          <p className="text-sm font-semibold text-gray-900">Authorized Signature</p>
          <p className="text-xs text-gray-500">{companyName}</p>
        </div>
      </div>
      
      {/* Print Footer */}
      <div className="mt-8 pt-4 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">Generated by ARTIRASA System on {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default InvoicePrint;
