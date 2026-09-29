import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import { clearTabSession, getTabToken, getTabUser, saveTabSession } from '../lib/tab-session'

type AuthUser = {
  id: number
  email: string
  full_name: string
  role: string
  /** Account lifecycle state. Only "active" reaches protected routes;
   *  the backend enforces that independently on every request. */
  status: string
  /** Null for a super admin, who operates the platform and owns no shop. */
  shop_id: number | null
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
  status: string
  shop_id: number | null
  shop_name?: string | null
  shop_logo_url?: string | null
}

type AuthContextType = {
  user: AuthUser | null
  shop: ShopInfo | null
  token: string | null
  loading: boolean
  isAuthenticated: boolean
  /** Convenience flag for conditional navigation and the admin route
   *  guard. Presentational only -- every admin API call is authorised
   *  server-side regardless of what this says. */
  isSuperAdmin: boolean
  login: (payload: LoginPayload) => void
  logout: () => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(getTabToken)
  const [user, setUser] = useState<AuthUser | null>(() => getTabUser<AuthUser>())
  const [shop, setShop] = useState<ShopInfo | null>(null)
  const [loading, setLoading] = useState(() => !!getTabToken() && !getTabUser<AuthUser>())

  const login = (payload: LoginPayload) => {
    const authUser: AuthUser = {
      id: payload.user_id,
      email: payload.email,
      full_name: payload.full_name,
      role: payload.role,
      status: payload.status,
      shop_id: payload.shop_id,
      shop_name: payload.shop_name || null,
      shop_logo_url: payload.shop_logo_url || null,
    }

    saveTabSession(payload.access_token, authUser)
    queryClient.clear()

    setToken(payload.access_token)
    setUser(authUser)
    setLoading(false)

    // A super admin has no shop; leaving `shop` null is what lets the shell
    // fall back to the platform brand instead of inventing a shop name.
    if (payload.shop_id == null) {
      setShop(null)
      return
    }

    setShop({
      id: payload.shop_id as number,
      name: payload.shop_name || undefined,
      logo_url: payload.shop_logo_url || null,
    })
  }

  const logout = () => {
    clearTabSession()
    queryClient.clear()
    setToken(null)
    setUser(null)
    setShop(null)
    window.location.href = '/'
  }

  const refreshMe = useCallback(async () => {
    const savedToken = getTabToken()
    if (!savedToken) return

    try {
      setLoading(true)

      const meRes = await api.get('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      })

      const me = meRes.data
      if (getTabToken() !== savedToken) return

      const authUser: AuthUser = {
        id: me.user_id ?? me.id,
        email: me.email,
        full_name: me.full_name,
        role: me.role,
        status: me.status,
        shop_id: me.shop_id,
        shop_name: me.shop_name || null,
        shop_logo_url: me.shop_logo_url || null,
      }

      saveTabSession(savedToken, authUser)
      setUser(authUser)

      // No shop id means no shop to fetch -- requesting /shops/null would
      // just 403 and fall into the catch below for no reason.
      if (me.shop_id == null) {
        setShop(null)
        return
      }

      try {
        const shopRes = await api.get(`/api/v1/shops/${me.shop_id}`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        })

        const shopData = shopRes.data
        if (getTabToken() !== savedToken) return

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
        if (getTabToken() !== savedToken) return
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
    } catch {
      if (!getTabToken()) {
        setToken(null)
        setUser(null)
        setShop(null)
      }
    } finally {
      if (!getTabToken() || getTabToken() === savedToken) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token && !user) {
      refreshMe()
    }
  }, [token, refreshMe])

  const value = useMemo(
    () => ({
      user,
      shop,
      token,
      loading,
      isAuthenticated: !!token && !!user,
      isSuperAdmin: user?.role === 'super_admin',
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
