import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'

type AuthUser = {
  id: number
  email: string
  full_name: string
  role: string
  shop_id: number
  shop_name?: string | null
  shop_logo_url?: string | null
}

type ShopInfo = {
  id: number
  name?: string
  logo_url?: string | null
  email?: string | null
  phone?: string | null
  whatsapp_number?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
}

type LoginPayload = {
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

type AuthContextType = {
  user: AuthUser | null
  shop: ShopInfo | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => void
  logout: () => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'access_token'
const USER_KEY = 'auth_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  })
  const [shop, setShop] = useState<ShopInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const login = (payload: LoginPayload) => {
    const authUser: AuthUser = {
      id: payload.user_id,
      email: payload.email,
      full_name: payload.full_name,
      role: payload.role,
      shop_id: payload.shop_id,
      shop_name: payload.shop_name || null,
      shop_logo_url: payload.shop_logo_url || null,
    }

    localStorage.setItem(TOKEN_KEY, payload.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(authUser))

    setToken(payload.access_token)
    setUser(authUser)

    setShop((prev) => ({
      id: payload.shop_id,
      name: payload.shop_name || prev?.name,
      logo_url: payload.shop_logo_url || prev?.logo_url || null,
      email: prev?.email || null,
      phone: prev?.phone || null,
      whatsapp_number: prev?.whatsapp_number || null,
      address: prev?.address || null,
      city: prev?.city || null,
      state: prev?.state || null,
      pincode: prev?.pincode || null,
    }))
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setShop(null)
    window.location.href = '/login'
  }

  const refreshMe = async () => {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    if (!savedToken) return

    try {
      setLoading(true)

      const meRes = await api.get('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      })

      const me = meRes.data

      const authUser: AuthUser = {
        id: me.user_id ?? me.id,
        email: me.email,
        full_name: me.full_name,
        role: me.role,
        shop_id: me.shop_id,
        shop_name: me.shop_name || null,
        shop_logo_url: me.shop_logo_url || null,
      }

      localStorage.setItem(USER_KEY, JSON.stringify(authUser))
      setUser(authUser)

      try {
        const shopRes = await api.get(`/api/v1/shops/${me.shop_id}`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        })

        const shopData = shopRes.data

        setShop({
          id: shopData.id,
          name: shopData.name || me.shop_name || null,
          logo_url: shopData.logo_url || me.shop_logo_url || null,
          email: shopData.email || null,
          phone: shopData.phone || null,
          whatsapp_number: shopData.whatsapp_number || null,
          address: shopData.address || null,
          city: shopData.city || null,
          state: shopData.state || null,
          pincode: shopData.pincode || null,
        })
      } catch {
        setShop({
          id: me.shop_id,
          name: me.shop_name || null,
          logo_url: me.shop_logo_url || null,
          email: null,
          phone: null,
          whatsapp_number: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
        })
      }
    } catch (error) {
      console.error('refreshMe failed', error)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken(null)
      setUser(null)
      setShop(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token && !user) {
      refreshMe()
    }
  }, [token])

  const value = useMemo(
    () => ({
      user,
      shop,
      token,
      loading,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      refreshMe,
    }),
    [user, shop, token, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}