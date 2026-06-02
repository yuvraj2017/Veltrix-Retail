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
}

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
  stock_quantity: number
  low_stock_threshold: number
  unit: string
  barcode?: string | null
  is_active: boolean
  main_image_url?: string | null
}

export type UpdateProductPayload = Partial<CreateProductPayload>