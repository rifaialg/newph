import React from 'react';
import { Item } from '../../types/database';
import { Plus, ShoppingBag } from 'lucide-react';
import Button from '../ui/Button';

interface ProductCardProps {
  item: Item;
  onAddToCart: (item: Item) => void;
  onBuyNow: (item: Item) => void;
  stock: number;
}

const ProductCard: React.FC<ProductCardProps> = ({ item, onAddToCart, onBuyNow, stock }) => {
  // Gunakan selling_price jika ada, jika tidak fallback ke 0
  const displayPrice = item.selling_price || 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-navbar-accent-1/30 transition-all duration-300 overflow-hidden group flex flex-col h-full">
      <div className="relative overflow-hidden h-48 bg-gray-100">
        {/* Product Image or Placeholder */}
        {item.image_url ? (
            <img 
                src={item.image_url} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                    // Fallback if image fails to load
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${item.name}&background=random&size=128&font-size=0.33`;
                }}
            />
        ) : (
            <div className={`w-full h-full bg-gradient-to-br ${['from-orange-100 to-amber-50', 'from-blue-100 to-cyan-50', 'from-green-100 to-emerald-50', 'from-purple-100 to-fuchsia-50'][item.id % 4]} flex items-center justify-center`}>
                 <img 
                    src={`https://ui-avatars.com/api/?name=${item.name}&background=random&size=128&font-size=0.33`} 
                    alt={item.name} 
                    className="w-24 h-24 shadow-lg rounded-full object-cover group-hover:scale-110 transition-transform duration-500"
                 />
            </div>
        )}
        
        {/* Stock Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${
            stock > 10 
              ? 'bg-white/90 backdrop-blur-sm text-green-600' 
              : stock > 0 
                ? 'bg-white/90 backdrop-blur-sm text-orange-500' 
                : 'bg-white/90 backdrop-blur-sm text-red-500'
          }`}>
            {stock > 0 ? `${stock} ${item.unit}` : 'Out of Stock'}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-1">
          <span className="text-xs font-semibold text-navbar-accent-1 uppercase tracking-wider">
            {item.item_categories?.name || 'General'}
          </span>
        </div>
        
        <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-navbar-accent-1 transition-colors">
          {item.name}
        </h3>
        
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-grow">
          {item.sku ? `SKU: ${item.sku}` : 'Premium quality product for your outlet.'}
        </p>

        <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Harga Jual</span>
            <span className="text-lg font-bold text-gray-900">
              Rp {displayPrice.toLocaleString('id-ID')}
            </span>
          </div>
          
          <div className="flex gap-2">
            {/* Add to Cart Button */}
            <button
              onClick={() => onAddToCart(item)}
              disabled={stock <= 0}
              className={`
                flex-1 py-2.5 rounded-xl transition-all duration-200 shadow-sm flex items-center justify-center text-sm font-medium border
                ${stock > 0 
                  ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-navbar-accent-1' 
                  : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'}
              `}
              title="Add to Cart"
            >
              <Plus size={16} className="mr-1" /> Cart
            </button>

            {/* Order Produk (Buy Now) Button */}
            <button
              onClick={() => onBuyNow(item)}
              disabled={stock <= 0}
              className={`
                flex-1 py-2.5 rounded-xl transition-all duration-200 shadow-sm flex items-center justify-center text-sm font-medium
                ${stock > 0 
                  ? 'bg-navbar-accent-1 text-white hover:bg-navbar-accent-2 hover:shadow-glow-gold hover:scale-105 active:scale-95' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
              title="Order Directly"
            >
              <ShoppingBag size={16} className="mr-1" /> Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
