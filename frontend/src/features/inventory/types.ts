export type InventorySummary = {
  active_products: number
  total_sellable_units: number
  low_stock_products: number
  out_of_stock_products: number
  current_inventory_value: string | number
  reconciliation_mismatches: number
  open_purchase_orders: number
  partially_received_purchase_orders: number
  unapplied_vendor_credit: string | number
  valuation_basis: string
}

export type InventoryProduct = {
  product_id: number
  name: string
  sku: string
  barcode: string | null
  category: string
  is_active: boolean
  stock_quantity: number
  low_stock_threshold: number
  stock_status: 'out_of_stock' | 'low_stock' | 'normal'
  threshold_gap: number
  buying_price: string | number
  inventory_value: string | number
  incoming_quantity: number
}

export type InventoryMovement = {
  id: number
  product_id: number
  product_name: string
  product_sku: string
  movement_type: string
  quantity_before: number
  quantity_delta: number
  quantity_after: number
  direction: 'in' | 'out' | 'zero'
  reason: string | null
  notes: string | null
  reference_type: string
  reference_label: string
  reference_url: string | null
  actor_name: string | null
  occurred_at: string
}

export type InventoryActivity = {
  date_from: string
  date_to: string
  opening_balance_units: number
  units_sold: number
  customer_return_units_restocked: number
  purchase_units_received: number
  purchase_units_returned: number
  adjustment_in_units: number
  adjustment_out_units: number
  draft_reserved_units: number
  draft_released_units: number
  net_movement: number
  current_sellable_units: number
}

export type ReconciliationItem = {
  product_id: number
  sku: string
  product_name: string
  current_balance: number
  ledger_balance: number
  difference: number
  matches: boolean
}

export type PurchasingReportItem = {
  purchase_order_id: number
  purchase_order_number: string
  vendor_id: number
  vendor_name: string
  order_date: string
  expected_date: string | null
  status: string
  ordered_quantity: number
  received_quantity: number
  remaining_quantity: number
  ordered_value: string | number
  purchase_return_quantity: number
  purchase_return_value: string | number
  overdue_expected_receipt: boolean
}

export type VendorPurchasingInsight = {
  vendor_id: number
  vendor_name: string
  purchase_order_count: number
  ordered_value: string | number
  received_value: string | number
  purchase_return_value: string | number
  outstanding_vendor_bills: string | number
  unapplied_vendor_credit: string | number
}

export type Paged<T> = { items: T[]; total: number; page: number; page_size: number }

export type ProductInventoryDetail = {
  product: InventoryProduct
  reconciliation: ReconciliationItem
  recent_movements: InventoryMovement[]
  recent_receipts: Array<{
    receipt_number: string
    purchase_order_number: string
    received_date: string
    quantity: number
    unit_cost: string | number
  }>
  recent_purchase_returns: Array<{
    return_number: string
    purchase_order_number: string
    return_date: string
    quantity: number
    value: string | number
  }>
}
