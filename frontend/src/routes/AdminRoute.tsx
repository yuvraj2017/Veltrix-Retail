import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Guards the /admin/* routes.
 *
 * This is UX layering, not the security boundary. It stops a regular user from
 * reaching an admin screen by typing the URL, but the actual protection is the
 * `require_super_admin` dependency on every admin endpoint -- so even if this
 * check were bypassed by editing client state, every request behind it would
 * still be refused with a 403 and the pages would render nothing.
 *
 * Sits inside ProtectedRoute, so authentication has already been established
 * by the time this runs.
 */
export function AdminRoute() {
  const { isSuperAdmin, loading } = useAuth()

  if (loading) {
    return <div className="p-8 text-slate-600 dark:text-slate-300">Checking permissions...</div>
  }

  // Redirected rather than shown an error page: a regular user has no reason to
  // know these routes exist.
  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
