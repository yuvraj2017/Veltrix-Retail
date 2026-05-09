export type Shop = {
  id: number
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

export type RegisterResponse = {
  message: string
  shop: Shop
  user: User
}


export type AuthUser = {
  user_id: number
  email: string
  full_name: string
  role: string
  shop_id: number
  shop_name?: string | null
  shop_logo_url?: string | null
}

export type LoginResponse = {
  access_token: string
  token_type: string
  user_id: number
  email: string
  full_name: string
  role: string
  shop_id: number
  shop_name?: string | null
  shop_logo_url?: string | null
}

export type MeResponse = {
  user: User
  shop: Shop
}