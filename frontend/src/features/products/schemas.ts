import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(2, 'SKU is required'),
  category: z.string().min(2, 'Category is required'),

  description: z.string(),
  buying_price: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  selling_price: z.coerce.number().min(0),

  stock_quantity: z.coerce.number().int().min(0),
  low_stock_threshold: z.coerce.number().int().min(0),

  unit: z.string().min(1, 'Unit is required'),
  barcode: z.string(),
  is_active: z.boolean(),
  main_image_url: z.string(),
})

export type ProductFormValues = z.infer<typeof productSchema>