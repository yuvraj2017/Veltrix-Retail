import { z } from 'zod'

export const customerPayloadSchema = z.object({
  id: z.number().optional().nullable(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional().nullable(),
  phone: z.string().min(5, 'Phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  gst_number: z.string().optional().nullable(),
})

export const invoiceItemCreateSchema = z.object({
  product_id: z.number(),
  product_code: z.string().min(1, 'Product code is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  discount_percentage: z.number().min(0).max(100),
  discount_amount_per_unit: z.number().min(0).optional().nullable(),
  selling_price_per_unit: z.number().min(0).optional().nullable(),
})

export const invoiceCreateSchema = z.object({
  customer: customerPayloadSchema,
  items: z.array(invoiceItemCreateSchema).min(1, 'Add at least one product'),
  invoice_date: z.string().optional().nullable(),
  payment_status: z.enum(['pending', 'paid', 'partial']),
  payment_mode: z
    .enum(['cash', 'upi', 'card', 'bank_transfer', 'other'])
    .optional()
    .nullable(),
  paid_amount: z.number().min(0),
  total_payable_amount: z.number().min(0).optional().nullable(),
  total_tax_amount: z.number().min(0),
  invoice_status: z.enum(['draft', 'saved', 'cancelled']),
  notes: z.string().optional().nullable(),
})

export type CustomerPayloadFormValues = z.infer<typeof customerPayloadSchema>
export type InvoiceCreateFormValues = z.infer<typeof invoiceCreateSchema>
