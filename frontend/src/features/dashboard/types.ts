export type DashboardStat = {
  title: string
  value: string
  change: string
  positive?: boolean
  highlight?: boolean
  warning_label?: string
}

export type RecentBill = {
  id: string
  date: string
  amount: string
  status: 'PAID' | 'PENDING' | 'PARTIAL' | 'OVERDUE'
}

export type LowStockProduct = {
  id: string
  name: string
  sku: string
  left: number
  image: string | null
}

export type SalesTrendPoint = {
  label: string
  value: number
}

export type RevenueProfitPoint = {
  label: string
  revenue: number
  profit: number
}

export type DashboardOverview = {
  greeting_name: string
  performance_label: string
  stats: DashboardStat[]
  sales_trends: SalesTrendPoint[]
  revenue_profit: RevenueProfitPoint[]
  recent_bills: RecentBill[]
  low_stock_products: LowStockProduct[]
}