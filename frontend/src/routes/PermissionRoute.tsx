import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function PermissionRoute({
  permission,
  children,
}: {
  permission: string
  children?: ReactNode
}) {
  const { hasPermission, loading } = useAuth()

  if (loading) {
    return <div className="p-8 text-sm font-semibold text-slate-500">Checking access...</div>
  }

  if (!hasPermission(permission)) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <ShieldAlert size={24} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-black text-slate-950 dark:text-white">Access unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Your current business role does not allow access to this area.
          </p>
          <Link
            to="/dashboard"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Return to dashboard
          </Link>
        </div>
      </section>
    )
  }

  return children ?? <Outlet />
}
