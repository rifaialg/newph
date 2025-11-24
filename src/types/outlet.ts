// Update types to support the new module structure
export interface OutletStockItem {
  id: number;
  name: string;
  sku: string;
  current_stock: number;
  min_stock: number;
  unit: string;
  status: 'aman' | 'menipis' | 'habis';
  last_movement?: string;
  category?: string;
}

export interface SalesDataPoint {
  date: string;
  total_sales: number;
  transaction_count: number;
}

export interface PnLMetrics {
  revenue: number;
  cogs: number;
  operational_cost: number;
  net_profit: number;
  trend_revenue: number;
  trend_profit: number;
}

export interface OutletRequestItem {
  item_id: number;
  quantity: number;
  notes?: string;
}

export type OutletViewMode = 'dashboard' | 'stock' | 'sales' | 'request' | 'opname' | 'reports';
