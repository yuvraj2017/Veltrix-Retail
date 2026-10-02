export type PurchaseOrderStatus =
  | 'draft'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled'

export type PurchaseOrderItem = {
  id: number
  product_id: number
  product_name: string
  product_sku: string
  ordered_quantity: number
  received_quantity: number
  unit_cost: string | number
  line_total: string | number
}

export type PurchaseOrder = {
  id: number
  shop_id: number
  vendor_id: number
  purchase_order_number: string
  order_date: string
  expected_date: string | null
  status: PurchaseOrderStatus
  notes: string | null
  subtotal: string | number
  tax_amount: string | number
  total_amount: string | number
  created_by: number | null
  created_at: string
  updated_at: string
  items: PurchaseOrderItem[]
}

export type PurchaseOrderList = {
  items: PurchaseOrder[]
  total: number
  page: number
  page_size: number
}

export type PurchaseOrderPayload = {
  vendor_id: number
  order_date: string
  expected_date?: string | null
  status: 'draft' | 'ordered'
  notes?: string | null
  tax_amount: number
  items: Array<{
    product_id: number
    ordered_quantity: number
    unit_cost: number
  }>
}

export type GoodsReceipt = {
  id: number
  shop_id: number
  purchase_order_id: number
  receipt_number: string
  received_date: string
  client_request_id: string
  notes: string | null
  received_by: number | null
  created_at: string
  items: Array<{
    id: number
    purchase_order_item_id: number
    product_id: number
    received_quantity: number
    unit_cost: string | number
  }>
}

export type PurchaseReturnEligibility = {
  goods_receipt_item_id: number
  goods_receipt_id: number
  receipt_number: string
  product_id: number
  product_name: string
  product_sku: string
  ordered_quantity: number
  received_quantity: number
  already_returned_quantity: number
  remaining_returnable_quantity: number
  current_stock_quantity: number
  unit_cost: string | number
}

export type VendorCredit = {
  id: number
  shop_id: number
  vendor_id: number
  purchase_return_id: number
  vendor_bill_id: number | null
  amount: string | number
  applied_amount: string | number
  status: 'unapplied' | 'partial' | 'applied'
  created_at: string
}

export type PurchaseReturn = {
  id: number
  shop_id: number
  vendor_id: number
  purchase_order_id: number
  goods_receipt_id: number | null
  return_number: string
  return_date: string
  reason: string
  notes: string | null
  client_request_id: string
  total_amount: string | number
  created_by: number | null
  created_at: string
  items: Array<{
    id: number
    product_id: number
    goods_receipt_item_id: number
    returned_quantity: number
    unit_cost: string | number
    line_total: string | number
  }>
  credit: VendorCredit | null
}
