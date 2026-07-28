export type ReportPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type ReportSummary = {
  total_revenue: number
  total_profit: number
  total_expenses: number
  net_profit: number
  collection_rate: number
  outstanding_receivables: number
  outstanding_payables: number
  average_order_value: number
  active_customers: number
  total_customers: number
}

export type TrendPoint = {
  label: string
  revenue: number
  profit: number
  expenses: number
  collections: number
  outstanding: number
  net: number
}

export type CategoryPerformanceItem = {
  category: string
  revenue: number
  profit: number
  quantity: number
  orders: number
}

export type CustomerInsightPoint = {
  label: string
  new_customers: number
  repeat_customers: number
  repeat_revenue: number
}

export type PaymentStatusItem = {
  status: string
  count: number
  amount: number
  percentage: number
}

export type SalesProfitReport = {
  period: ReportPeriod
  points: TrendPoint[]
  total_revenue: number
  total_profit: number
  profit_margin: number
}

export type CashflowReport = {
  period: ReportPeriod
  points: TrendPoint[]
  total_collections: number
  total_expenses: number
  net_cashflow: number
  outstanding_receivables: number
}

export type CategoryPerformanceReport = {
  period: ReportPeriod
  items: CategoryPerformanceItem[]
  top_category: string | null
}

export type CustomerInsightsReport = {
  period: ReportPeriod
  points: CustomerInsightPoint[]
  total_new_customers: number
  total_repeat_customers: number
  repeat_revenue: number
  repeat_rate: number
}

export type PaymentInsightsReport = {
  period: ReportPeriod
  statuses: PaymentStatusItem[]
  collected_amount: number
  outstanding_amount: number
  overdue_amount: number
}
