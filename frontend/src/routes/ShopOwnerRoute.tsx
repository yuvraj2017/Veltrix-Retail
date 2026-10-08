import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'

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
  const { selectedBranchId, branchLoading, branchError, refreshBranches } = useBranch()

  if (loading) {
    return <div className="p-8 text-slate-600 dark:text-slate-300">Loading...</div>
  }

  if (isSuperAdmin) {
    return <Navigate to="/admin" replace />
  }

  if (branchLoading) {
    return <div className="p-8 text-sm font-semibold text-slate-600 dark:text-slate-300">Loading branch access...</div>
  }

  if (!selectedBranchId) {
    return (
      <section className="mx-auto mt-12 max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="text-xl font-bold text-slate-950 dark:text-white">Branch access unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {branchError || 'Your account has no active branch assignment. Contact your business owner or administrator.'}
        </p>
        <button type="button" onClick={() => void refreshBranches()} className="mt-5 min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700">
          Retry
        </button>
      </section>
    )
  }

  return <div key={selectedBranchId}><Outlet /></div>
}
