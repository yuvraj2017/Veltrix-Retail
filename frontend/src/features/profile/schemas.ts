import { z } from 'zod'

export const profileSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string(),
  profile_image_url: z.string(),
  timezone: z.string(),
  language: z.string(),
  two_factor_enabled: z.boolean(),
})

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(6, 'Current password is required'),
    new_password: z.string().min(6, 'New password must be at least 6 characters'),
    confirm_password: z.string().min(6, 'Confirm password is required'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type ProfileFormValues = z.infer<typeof profileSchema>
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>