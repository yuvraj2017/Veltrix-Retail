import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Guards the shop-owner side of the app.
 *
 * A super admin runs the platform and owns no shop, so these screens have no
 * data for them — the backend's `get_shop_user` dependency refuses every
 * request behind them with a 403. Rather than let an administrator walk into a
 * wall of permission errors, send them to the area that is actually theirs.
 *
 * The mirror image of AdminRoute, and like it, purely a UX concern: the real
 * boundary is server-side.
 */
export function ShopOwnerRoute() {
  const { isSuperAdmin, loading } = useAuth()

  if (loading) {
    return <div className="p-8 text-slate-600 dark:text-slate-300">Loading...</div>
  }

  if (isSuperAdmin) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
