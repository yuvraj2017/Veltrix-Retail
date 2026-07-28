export type CustomerStatus = 'VIP' | 'ACTIVE' | 'INACTIVE'

export type CustomerRecord = {
  id: number
  shop_id: number
  first_name: string
  last_name?: string | null
  full_name: string
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  gst_number?: string | null
  total_orders: number
  total_spent: string | number
  created_at: string
  updated_at: string
}

export type CustomerDirectoryItem = {
  customer_id: number
  full_name: string
  first_name: string
  last_name?: string | null
  phone: string
  email?: string | null
  city?: string | null
  state?: string | null
  total_orders: number
  total_spent: string | number
  outstanding_amount: string | number
  average_order_value: string | number
  first_invoice_date?: string | null
  last_invoice_date?: string | null
  status: CustomerStatus
}

export type CustomerDirectoryResponse = {
  items: CustomerDirectoryItem[]
  total: number
  page: number
  page_size: number
}

export type CustomerSummary = {
  total_customers: number
  billed_customers: number
  active_customers: number
  inactive_customers: number
  vip_customers: number
  total_revenue: string | number
  average_lifetime_value: string | number
  repeat_customer_rate: string | number
  outstanding_amount: string | number
}

export type CustomerRevenueTrendPoint = {
  label: string
  revenue: string | number
  collected_amount: string | number
  invoice_count: number
}

export type CustomerGrowthPoint = {
  label: string
  new_customers: number
  returning_customers: number
}

export type CustomerStatusBreakdownItem = {
  status: CustomerStatus
  count: number
}

export type CustomerTopCustomerItem = {
  customer_id: number
  customer_name: string
  total_spent: string | number
  total_orders: number
  outstanding_amount: string | number
  status: CustomerStatus
}

export type CustomerCharts = {
  revenue_trend: CustomerRevenueTrendPoint[]
  customer_growth: CustomerGrowthPoint[]
  status_breakdown: CustomerStatusBreakdownItem[]
  top_customers: CustomerTopCustomerItem[]
}

export type CustomerInsight = {
  vip_customers: number
  active_customers: number
  inactive_customers: number
  repeat_customer_rate: string | number
  retention_message: string
  top_customers: CustomerTopCustomerItem[]
}

export type CustomerInvoiceHistoryItem = {
  invoice_id: number
  invoice_number: string
  invoice_date: string
  final_amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  total_profit: string | number
  payment_status: string
  invoice_status: string
}

export type CustomerPurchasedProductItem = {
  product_id?: number | null
  product_code?: string | null
  product_name: string
  category?: string | null
  total_quantity: string | number
  total_sales: string | number
  total_profit: string | number
}

export type CustomerSpendTrendPoint = {
  label: string
  total_spend: string | number
  collected_amount: string | number
}

export type CustomerAnalyticsDetail = {
  customer_id: number
  full_name: string
  first_name: string
  last_name?: string | null
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  gst_number?: string | null
  total_orders: number
  total_spent: string | number
  outstanding_amount: string | number
  average_order_value: string | number
  total_profit: string | number
  first_invoice_date?: string | null
  last_invoice_date?: string | null
  status: CustomerStatus
  invoices: CustomerInvoiceHistoryItem[]
  products: CustomerPurchasedProductItem[]
  spend_trend: CustomerSpendTrendPoint[]
}

export type CustomerPayload = {
  first_name: string
  last_name?: string | null
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  gst_number?: string | null
}
