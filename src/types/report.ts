export interface Order {
  id: string;
  date: string; // ISO String
  outlet_name: string;
  pic_name: string;
  total_items: number;
  total_amount: number;
  status: 'completed' | 'pending' | 'cancelled';
  items: string[]; // List of item names for tooltip/details
}

export interface OrderMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageValue: number;
}
