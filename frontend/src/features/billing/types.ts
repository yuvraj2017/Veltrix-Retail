export type PaymentStatus = 'pending' | 'paid' | 'partial'
export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
export type InvoiceStatus = 'draft' | 'saved' | 'cancelled'

export type CustomerPayload = {
  id?: number | null
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

export type CustomerSearchResult = {
  id: number
  full_name: string
  phone: string
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  gst_number?: string | null
}

export type BillingProduct = {
  id: number
  name: string
  product_code: string
  sku?: string | null
  barcode?: string | null
  category?: string | null
  unit?: string | null
  mrp: string | number
  buying_price: string | number
  selling_price: string | number
  available_stock: string | number
  is_active: boolean
}

export type InvoiceItemCreatePayload = {
  product_id: number
  product_code: string
  quantity: number
  discount_percentage: number
  discount_amount_per_unit?: number | null
  selling_price_per_unit?: number | null
}

export type InvoiceCreatePayload = {
  customer: CustomerPayload
  items: InvoiceItemCreatePayload[]
  invoice_date?: string | null
  payment_status: PaymentStatus
  payment_mode?: PaymentMode | null
  paid_amount: number
  total_tax_amount: number
  invoice_status: InvoiceStatus
  notes?: string | null
}

export type InvoiceItem = {
  id: number
  shop_id: number
  invoice_id: number
  product_id?: number | null
  product_code: string
  product_name_snapshot: string
  category_snapshot?: string | null
  unit_snapshot?: string | null
  mrp: string | number
  buy_price: string | number
  quantity: string | number
  discount_percentage: string | number
  discount_amount_per_unit: string | number
  total_discount_amount: string | number
  selling_price_per_unit: string | number
  total_selling_price: string | number
  total_buy_cost: string | number
  profit_per_unit: string | number
  total_profit: string | number
  created_at: string
  updated_at: string
}

export type Invoice = {
  id: number
  shop_id: number
  invoice_number: string
  customer_id?: number | null

  customer_name_snapshot: string
  customer_phone_snapshot: string
  customer_email_snapshot?: string | null
  customer_address_snapshot?: string | null
  customer_city_snapshot?: string | null
  customer_state_snapshot?: string | null
  customer_pincode_snapshot?: string | null
  customer_gst_number_snapshot?: string | null

  invoice_date: string

  subtotal_amount: string | number
  total_discount_amount: string | number
  total_tax_amount: string | number
  final_amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  total_buy_cost: string | number
  total_profit: string | number

  payment_status: PaymentStatus
  payment_mode?: PaymentMode | null
  invoice_status: InvoiceStatus

  notes?: string | null
  created_by?: number | null

  created_at: string
  updated_at: string

  items: InvoiceItem[]
}

export type InvoiceListItem = {
  id: number
  invoice_number: string
  customer_id?: number | null
  customer_name_snapshot: string
  customer_phone_snapshot: string
  invoice_date: string
  subtotal_amount: string | number
  total_discount_amount: string | number
  total_tax_amount: string | number
  final_amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  total_profit: string | number
  payment_status: PaymentStatus
  payment_mode?: PaymentMode | null
  invoice_status: InvoiceStatus
  created_at: string
}

export type InvoiceListResponse = {
  items: InvoiceListItem[]
  total: number
  page: number
  page_size: number
}

export type InvoiceStats = {
  total_invoices: number
  total_sales_amount: string | number
  total_discount_given: string | number
  total_profit: string | number
  today_sales: string | number
  monthly_sales: string | number
  pending_amount: string | number
  paid_amount: string | number
  paid_invoices: number
  pending_invoices: number
  partial_invoices: number
}

export type InvoicePreviewResponse = {
  invoice: Invoice
  customer?: {
    id: number
    full_name: string
    phone: string
    email?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    pincode?: string | null
    gst_number?: string | null
  } | null
}

export type InvoiceShareResponse = {
  message: string
  whatsapp_url?: string | null
}

export type LocalInvoiceItem = {
  product_id: number
  product_code: string
  product_name: string
  category?: string | null
  unit?: string | null
  mrp: number
  buy_price: number
  available_stock: number
  quantity: number
  discount_percentage: number
  discount_amount_per_unit: number
  selling_price_per_unit: number
  total_discount_amount: number
  total_selling_price: number
  total_buy_cost: number
  profit_per_unit: number
  total_profit: number
}