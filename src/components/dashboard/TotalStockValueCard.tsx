import React, { useMemo } from 'react';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

// Definisikan interface TypeScript untuk produk
export interface Product {
  id: string | number;
  name: string;
  stock: number;
  price: number;
}

interface TotalStockValueCardProps {
  products?: Product[];
}

const TotalStockValueCard: React.FC<TotalStockValueCardProps> = ({ products }) => {
  // Tangani kasus saat data sedang dimuat (props `products` masih undefined)
  if (products === undefined) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-medium text-gray-500">Total Stock Value</h3>
        <Skeleton className="h-9 w-48 mt-2" />
      </Card>
    );
  }

  // Gunakan useMemo untuk mengoptimalkan kalkulasi total nilai
  const totalValue = useMemo(() => {
    if (!products || products.length === 0) {
      return 0;
    }
    return products.reduce((sum, product) => sum + product.stock * product.price, 0);
  }, [products]);

  // Format nilai ke dalam mata uang Rupiah (IDR)
  const formattedValue = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(totalValue);

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-gray-500">Total Stock Value</h3>
      <p className="text-3xl font-semibold text-gray-900 mt-2">{formattedValue}</p>
    </Card>
  );
};

export default TotalStockValueCard;
