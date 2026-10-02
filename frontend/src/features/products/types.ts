export type ProductImage = {
  id: number
  image_url: string
  sort_order: number
  is_main: boolean
  created_at: string
}

export type Product = {
  id: number
  shop_id: number
  name: string
  sku: string
  category: string
  description: string | null

  buying_price: string
  mrp: string
  selling_price: string
  hsn_sac: string | null
  gst_rate: string | number

  stock_quantity: number
  low_stock_threshold: number

  unit: string
  barcode: string | null
  is_active: boolean
  main_image_url: string | null

  total_units_sold: number
  total_sales_amount: string
  total_profit_amount: string
  last_sold_at: string | null
  last_restocked_at: string | null

  created_at: string
  updated_at: string

  images: ProductImage[]
}

export type ProductListResponse = {
  items: Product[]
  total: number
  page: number
  page_size: number
}

export type ProductSort =
  | 'date_desc'
  | 'date_asc'
  | 'name_asc'
  | 'name_desc'
  | 'stock_asc'
  | 'stock_desc'

export type ProductStats = {
  total_items: number
  out_of_stock: number
  low_stock_count: number
  inventory_value: string
}

export type CreateProductPayload = {
  name: string
  sku: string
  category: string
  description?: string | null
  buying_price: number
  mrp: number
  selling_price: number
  hsn_sac?: string | null
  gst_rate: number
  stock_quantity: number
  low_stock_threshold: number
  unit: string
  barcode?: string | null
  is_active: boolean
  main_image_url?: string | null
}

export type UpdateProductPayload = Partial<CreateProductPayload>

export type StockMovement = {
  id: number
  shop_id: number
  product_id: number
  movement_type:
    | 'opening_balance'
    | 'sale'
    | 'sale_return'
    | 'draft_reserve'
    | 'draft_release'
    | 'adjustment_in'
    | 'adjustment_out'
    | 'purchase_receipt'
  quantity_delta: number
  quantity_before: number
  quantity_after: number
  reference_type: string | null
  reference_id: number | null
  reference_line_id: number | null
  reason: string | null
  notes: string | null
  occurred_at: string
  created_at: string
}

export type StockMovementList = {
  items: StockMovement[]
  total: number
  page: number
  page_size: number
}

export type StockAdjustmentResult = {
  id: number
  product_id: number
  operation_type: 'adjustment' | 'physical_count'
  movement_id: number | null
  movement_type: 'adjustment_in' | 'adjustment_out' | null
  quantity_before: number
  quantity_delta: number
  quantity_after: number
  reason: string
  notes: string | null
  client_request_id: string
  replayed: boolean
}
