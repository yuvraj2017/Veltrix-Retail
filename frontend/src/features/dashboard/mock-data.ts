import type {
  DashboardStat,
  LowStockProduct,
  RecentBill,
  RevenueProfitPoint,
  SalesTrendPoint,
} from './types'

export const stats: DashboardStat[] = [
  {
    title: 'TODAY SALES',
    value: '₹4,280',
    change: '+12.5%',
    positive: true,
  },
  {
    title: 'WEEKLY SALES',
    value: '₹28,450',
    change: '+8.2%',
    positive: true,
  },
  {
    title: 'REVENUE',
    value: '₹82,100',
    change: '+15.1%',
    positive: true,
  },
  {
    title: 'PROFIT',
    value: '₹14,820',
    change: '-2.4%',
    positive: false,
  },
  {
    title: 'LOW STOCK',
    value: '12 Items',
    change: 'Requires reorder',
    positive: false,
    highlight: true,
    warning_label: 'WARNING',
  },
]

export const recentBills: RecentBill[] = [
  {
    id: '#INV-1001',
    date: '19 May 2026',
    amount: '₹1,240.00',
    status: 'PAID',
  },
  {
    id: '#INV-1002',
    date: '18 May 2026',
    amount: '₹860.00',
    status: 'PENDING',
  },
  {
    id: '#INV-1003',
    date: '18 May 2026',
    amount: '₹2,150.00',
    status: 'PARTIAL',
  },
  {
    id: '#INV-1004',
    date: '17 May 2026',
    amount: '₹740.00',
    status: 'OVERDUE',
  },
]

export const lowStockProducts: LowStockProduct[] = [
  {
    id: '1',
    name: 'Premium Basmati Rice',
    sku: 'RICE-001',
    left: 3,
    image: null,
  },
  {
    id: '2',
    name: 'Organic Sugar Pack',
    sku: 'SUGAR-021',
    left: 5,
    image: null,
  },
]

export const salesTrends: SalesTrendPoint[] = [
  { label: 'MON', value: 40 },
  { label: 'TUE', value: 62 },
  { label: 'WED', value: 48 },
  { label: 'THU', value: 79 },
  { label: 'FRI', value: 72 },
  { label: 'SAT', value: 95 },
  { label: 'SUN', value: 88 },
]

export const revenueProfit: RevenueProfitPoint[] = [
  { label: 'Q1', revenue: 120000, profit: 22000 },
  { label: 'Q2', revenue: 146000, profit: 28000 },
  { label: 'Q3', revenue: 164000, profit: 31000 },
  { label: 'Q4', revenue: 181000, profit: 35000 },
  { label: 'YTD', revenue: 611000, profit: 116000 },
]