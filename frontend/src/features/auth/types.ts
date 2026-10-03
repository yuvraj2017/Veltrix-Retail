export type Shop = {
  id: number
  organization_id: number
  is_default_branch: boolean
  name: string
  category: string
  email: string
  phone: string
  address?: string | null
  logo_url?: string | null
  created_at: string
  updated_at: string
}

export type User = {
  id: number
  shop_id: number
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type RegisterPayload = {
  shop_name: string
  owner_name: string
  email: string
  category: string
  phone: string
  password: string
}

export type LoginPayload = {
  email: string
  password: string
}

export type ForgotPasswordPayload = {
  email: string
}

export type ResetPasswordPayload = {
  token: string
  new_password: string
}

export type AuthMessageResponse = {
  message: string
}

export type ResetTokenValidationResponse = {
  valid: boolean
  message: string
}

/** Registration confirmation. Carries no token by design: a new account
 *  is `pending` and cannot authenticate until a super admin approves it. */
export type RegisterResponse = {
  user_id: number
  email: string
  full_name: string
  role: string
  status: string
  shop_id: number
  shop_name?: string | null
  organization_id?: number | null
  organization_name?: string | null
  message: string
}

export type AuthUser = {
  user_id: number
  email: string
  full_name: string
  role: string
  status: string
  shop_id: number
  shop_name?: string | null
  shop_logo_url?: string | null
  organization_id?: number | null
  organization_name?: string | null
}

export type LoginResponse = {
  access_token: string
  token_type: string
  user_id: number
  email: string
  full_name: string
  role: string
  status: string
  shop_id: number
  shop_name?: string | null
  shop_logo_url?: string | null
  organization_id?: number | null
  organization_name?: string | null
}

export type MeResponse = {
  user_id: number
  email: string
  full_name: string
  role: string
  status: string
  shop_id: number
  shop_name?: string | null
  shop_logo_url?: string | null
  organization_id?: number | null
  organization_name?: string | null
}
