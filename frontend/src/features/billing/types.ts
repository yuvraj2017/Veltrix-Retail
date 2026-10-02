export type PaymentStatus = 'pending' | 'paid' | 'partial'
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
export type PaymentMode = PaymentMethod | 'mixed'
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
  hsn_sac?: string | null
  mrp: string | number
  buying_price: string | number
  selling_price: string | number
  available_stock: string | number
  gst_rate: string | number
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
  client_request_id?: string | null
  customer: CustomerPayload
  items: InvoiceItemCreatePayload[]
  invoice_date?: string | null
  payment_status: PaymentStatus
  payment_mode?: PaymentMode | null
  paid_amount: number
  payments?: InvoicePaymentInput[]
  total_payable_amount?: number | null
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
  hsn_sac_snapshot?: string | null
  gst_rate: string | number
  taxable_value: string | number
  cgst_rate: string | number
  cgst_amount: string | number
  sgst_rate: string | number
  sgst_amount: string | number
  igst_rate: string | number
  igst_amount: string | number
  total_tax_amount: string | number
  total_buy_cost: string | number
  profit_per_unit: string | number
  total_profit: string | number
  created_at: string
  updated_at: string
}

export type InvoicePaymentInput = {
  amount: number
  payment_method: PaymentMethod
  payment_reference?: string | null
  notes?: string | null
  received_at?: string | null
}

export type InvoicePaymentCreatePayload = InvoicePaymentInput & {
  client_request_id: string
}

export type InvoicePayment = {
  id: number
  shop_id: number
  invoice_id: number
  amount: string | number
  payment_method: PaymentMethod
  payment_reference?: string | null
  notes?: string | null
  status: string
  received_at: string
  created_by?: number | null
  created_at: string
}

export type InvoiceReturnItemCreatePayload = {
  invoice_item_id: number
  quantity: number
  restocked_quantity?: number
  disposition?: 'restock' | 'damaged' | 'defective' | 'other_non_restock'
  disposition_notes?: string | null
}

export type InvoiceReturnCreatePayload = {
  client_request_id: string
  reason: string
  notes?: string | null
  items: InvoiceReturnItemCreatePayload[]
}

export type InvoiceRefundCreatePayload = {
  client_request_id: string
  amount: number
  refund_method: PaymentMethod
  reference?: string | null
  notes?: string | null
}

export type InvoiceRefund = {
  id: number
  shop_id: number
  invoice_id: number
  return_id: number
  amount: string | number
  refund_method: PaymentMethod
  reference?: string | null
  notes?: string | null
  status: string
  refunded_at: string
  created_by?: number | null
  created_at: string
}

export type InvoiceReturnItem = {
  id: number
  shop_id: number
  return_id: number
  invoice_item_id: number
  product_id?: number | null
  product_code: string
  product_name_snapshot: string
  hsn_sac_snapshot?: string | null
  quantity: string | number
  restocked_quantity: number
  non_restocked_quantity: number
  disposition: 'restock' | 'damaged' | 'defective' | 'other_non_restock'
  disposition_notes?: string | null
  unit_taxable_value: string | number
  gst_rate: string | number
  cgst_rate: string | number
  cgst_amount: string | number
  sgst_rate: string | number
  sgst_amount: string | number
  igst_rate: string | number
  igst_amount: string | number
  taxable_value: string | number
  total_tax_amount: string | number
  total_amount: string | number
  total_buy_cost: string | number
  total_profit: string | number
  created_at: string
}

export type InvoiceReturn = {
  id: number
  shop_id: number
  invoice_id: number
  return_number: string
  credit_note_number: string
  status: string
  reason: string
  notes?: string | null
  subtotal_amount: string | number
  taxable_amount: string | number
  cgst_amount: string | number
  sgst_amount: string | number
  igst_amount: string | number
  total_tax_amount: string | number
  total_amount: string | number
  applied_to_outstanding_amount: string | number
  refundable_amount: string | number
  created_by?: number | null
  completed_at: string
  created_at: string
  items: InvoiceReturnItem[]
  refunds: InvoiceRefund[]
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
  customer_state_code_snapshot?: string | null
  customer_pincode_snapshot?: string | null
  customer_gst_number_snapshot?: string | null
  seller_gst_number_snapshot?: string | null
  seller_state_snapshot?: string | null
  seller_state_code_snapshot?: string | null
  tax_treatment: string

  invoice_date: string

  subtotal_amount: string | number
  total_discount_amount: string | number
  total_tax_amount: string | number
  billed_amount: string | number
  extra_discount_amount: string | number
  final_amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  total_buy_cost: string | number
  total_profit: string | number

  payment_status: PaymentStatus
  payment_mode?: PaymentMode | null
  invoice_status: InvoiceStatus
  finalized_at?: string | null

  notes?: string | null
  created_by?: number | null

  created_at: string
  updated_at: string

  items: InvoiceItem[]
  payments: InvoicePayment[]
  returns: InvoiceReturn[]
}

export type LocalPaymentLine = {
  id: string
  amount: number
  payment_method: PaymentMethod
  payment_reference: string
  notes: string
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
  billed_amount: string | number
  extra_discount_amount: string | number
  final_amount: string | number
  paid_amount: string | number
  remaining_amount: string | number
  total_profit: string | number
  payment_status: PaymentStatus
  payment_mode?: PaymentMode | null
  invoice_status: InvoiceStatus
  finalized_at?: string | null
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
  hsn_sac?: string | null
  mrp: number
  buy_price: number
  available_stock: number
  gst_rate: number
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
