export type Profile = {
  id: number
  shop_id: number
  full_name: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  role: string
  profile_image_url: string | null
  timezone: string | null
  language: string
  two_factor_enabled: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export type UpdateProfilePayload = {
  full_name: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  profile_image_url: string | null
  timezone: string | null
  language: string
  two_factor_enabled: boolean
}

export type ChangePasswordPayload = {
  current_password: string
  new_password: string
}