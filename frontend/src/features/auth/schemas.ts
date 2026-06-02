import { z } from 'zod'

export const registerSchema = z
  .object({
    shop_name: z.string().min(2, 'Shop name is required'),
    owner_name: z.string().min(2, 'Owner name is required'),
    email: z.string().email('Enter a valid email'),
    category: z.string().min(2, 'Category is required'),
    phone: z.string().min(6, 'Phone number is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(8, 'Confirm password is required'),
    logo: z.any().optional(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean(),
})

export type RegisterFormValues = z.infer<typeof registerSchema>
export type LoginFormValues = z.infer<typeof loginSchema>