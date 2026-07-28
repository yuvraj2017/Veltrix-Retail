import { z } from 'zod'

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value) return null
    return value
  })

export const customerSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(100, 'First name is too long'),
  last_name: optionalText,
  phone: z
    .string()
    .trim()
    .min(5, 'Phone number is required')
    .max(20, 'Phone number is too long'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address')
    .optional()
    .or(z.literal(''))
    .transform((value) => {
      if (!value) return null
      return value
    }),
  address: optionalText,
  city: optionalText,
  state: optionalText,
  pincode: optionalText,
  gst_number: optionalText,
})

export type CustomerFormValues = z.infer<typeof customerSchema>
