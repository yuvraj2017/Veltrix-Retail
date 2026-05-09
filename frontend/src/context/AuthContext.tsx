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

function normalizeShop(
  userLike: Partial<AuthUser> & { shop_name?: string | null; shop_logo_url?: string | null }
): ShopInfo | null {
  if (!userLike.shop_id) return null

  return {
    id: userLike.shop_id,
    name: userLike.shop_name || undefined,
    logo_url: userLike.shop_logo_url || null,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  })
  const [shop, setShop] = useState<ShopInfo | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw)
      return normalizeShop(parsed)
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)

  const login = (payload: LoginPayload) => {
    const authUser: AuthUser = {
      id: payload.user_id,
      email: payload.email,
      full_name: payload.full_name,
      role: payload.role,
      shop_id: payload.shop_id,
      shop_name: payload.shop_name ?? '',
      shop_logo_url: payload.shop_logo_url ?? '',
    }

    localStorage.setItem(TOKEN_KEY, payload.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(authUser))

    setToken(payload.access_token)
    setUser(authUser)
    setShop({
      id: payload.shop_id,
      name: payload.shop_name || undefined,
      logo_url: payload.shop_logo_url || null,
    })
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
        id: me.id ?? me.user_id,
        email: me.email,
        full_name: me.full_name,
        role: me.role,
        shop_id: me.shop_id,
        shop_name: me.shop_name ?? '',
        shop_logo_url: me.shop_logo_url ?? '',
      }

      localStorage.setItem(USER_KEY, JSON.stringify(authUser))
      setUser(authUser)

      if (me.shop_name || me.shop_logo_url) {
        setShop({
          id: me.shop_id,
          name: me.shop_name || undefined,
          logo_url: me.shop_logo_url || null,
        })
      } else {
        try {
          const shopRes = await api.get(`/api/v1/shops/${me.shop_id}`, {
            headers: {
              Authorization: `Bearer ${savedToken}`,
            },
          })
          setShop(shopRes.data)
        } catch {
          setShop({ id: me.shop_id })
        }
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