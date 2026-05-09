import type { LowStockProduct, RecentBill, StatCardData } from './types'

export const stats: StatCardData[] = [
  {
    title: 'TODAY SALES',
    value: '$4,280',
    change: '+12.5%',
    positive: true,
  },
  {
    title: 'WEEKLY SALES',
    value: '$28,450',
    change: '+8.2%',
    positive: true,
  },
  {
    title: 'REVENUE',
    value: '$82,100',
    change: '+15.1%',
    positive: true,
  },
  {
    title: 'PROFIT',
    value: '$14,820',
    change: '-2.4%',
    positive: false,
  },
  {
    title: 'LOW STOCK',
    value: '12 Items',
    change: 'Requires reorder',
    highlight: true,
  },
]

export const recentBills: RecentBill[] = [
  { id: '#INV-9281', date: 'Oct 24, 2023', amount: '$1,240.00', status: 'PAID' },
  { id: '#INV-9282', date: 'Oct 24, 2023', amount: '$840.50', status: 'PAID' },
  { id: '#INV-9283', date: 'Oct 23, 2023', amount: '$2,100.00', status: 'PENDING' },
  { id: '#INV-9284', date: 'Oct 23, 2023', amount: '$450.00', status: 'PAID' },
]

export const lowStockProducts: LowStockProduct[] = [
  {
    id: '1',
    name: 'Modern Watch Series X',
    sku: 'MW-002',
    left: 2,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '2',
    name: 'Audio-Plex Headphones',
    sku: 'AP-450',
    left: 5,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: '3',
    name: 'Velocity Run Sneakers',
    sku: 'VR-881',
    left: 1,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=400&auto=format&fit=crop',
  },
]