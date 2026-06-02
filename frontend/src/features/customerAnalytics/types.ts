export type CustomerAnalyticsStats = {
  total_billed_customers: number
  average_invoice_value: string | number
  total_revenue_from_customers: string | number
}

export type CustomerStatus = 'VIP' | 'ACTIVE' | 'INACTIVE'

export type CustomerLedgerRow = {
  customer_id: number
  customer_name: string
  phone?: string | null
  email?: string | null
  total_bills: number
  total_paid: string | number
  last_invoice_date?: string | null
  status: CustomerStatus
}

export type CustomerLedgerResponse = {
  items: CustomerLedgerRow[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export type CustomerInsight = {
  vip_customers: number
  active_customers: number
  inactive_customers: number
  retention_message: string
  top_customers: {
    customer_id: number
    customer_name: string
    total_spent: string | number
    total_orders: number
  }[]
}

export type CustomerDetail = {
  customer_id: number
  customer_name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  gst_number?: string | null
  total_bills: number
  total_spent: string | number
  total_profit: string | number
  last_invoice_date?: string | null
  status: CustomerStatus
  invoices: {
    invoice_id?: number | null
    invoice_number: string
    invoice_date: string
    total_amount: string | number
    profit: string | number
    payment_status?: string | null
  }[]
  products: {
    product_id?: number | null
    product_code?: string | null
    product_name: string
    category?: string | null
    total_quantity: string | number
    total_sales: string | number
    total_profit: string | number
  }[]
}