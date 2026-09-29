import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Clock3, RefreshCcw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  AccountStateCards,
  PlatformTradingCards,
  TopShopsCard,
} from '../../components/admin/AdminStatCards'
import { AuditTrailList } from '../../components/admin/AuditTrailList'
import { getAdminStats } from '../../features/admin/api'
import { getApiErrorMessage } from '../../lib/api-error'

/**
 * Platform owner overview.
 *
 * Two bands: how the platform is trading (revenue, profit, outstanding, volume
 * across every shop) and the state of the shop-owner accounts on it. Then the
 * top-performing shops, the signup trend, and recent administrative activity.
 *
 * All of it comes from GET /api/v1/admin/stats -- no placeholder metrics.
 */
export default function AdminDashboardPage() {
  const queryClient = useQueryClient()

  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
  })

  const stats = statsQuery.data
  const error = statsQuery.error
    ? getApiErrorMessage(statsQuery.error, 'Unable to load administration overview')
    : ''

  const trend = stats?.recent_registrations ?? []
  const maxTrend = Math.max(...trend.map((point) => point.count), 1)

  return (
    <section className="mx-auto w-full max-w-[1600px] px-0 sm:px-2">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-6 mt-2 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-400">
            <ShieldCheck size={13} />
            Super Admin
          </div>

          <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 dark:text-slate-100 sm:text-4xl">
            Administration
          </h1>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-400 sm:mt-2">
            Track how your shop owners are trading, review new registrations, and
            manage account access.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin'] })}
            disabled={statsQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-xl bg-[#f0f2f7] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#e8ecf4] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <RefreshCcw
              size={15}
              className={statsQuery.isFetching ? 'animate-spin' : undefined}
            />
            Refresh
          </button>

          <Link
            to="/admin/users?status=pending"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 dark:hover:bg-indigo-500"
          >
            <Clock3 size={15} />
            Pending Approvals
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {statsQuery.isPending ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-[148px] animate-pulse rounded-[22px] bg-white shadow-sm dark:bg-slate-800"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="h-[340px] animate-pulse rounded-[2rem] bg-white shadow-sm dark:bg-slate-800" />
            <div className="h-[340px] animate-pulse rounded-[2rem] bg-white shadow-sm dark:bg-slate-800" />
          </div>
        </div>
      ) : stats ? (
        <>
          {/* Money first -- it is what the platform owner opens this page for. */}
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Platform performance
          </h2>
          <PlatformTradingCards stats={stats} />

          <h2 className="mb-3 mt-7 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Shop owner accounts
          </h2>
          <AccountStateCards stats={stats} />

          {/* Call to action, shown only when there is something to act on. */}
          {stats.pending_users > 0 && (
            <Link
              to="/admin/users?status=pending"
              className="group mt-5 flex flex-col gap-3 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 transition hover:-translate-y-[1px] hover:shadow-[0_16px_40px_rgba(217,119,6,0.12)] dark:border-amber-900 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm dark:bg-slate-900 dark:text-amber-400">
                  <Clock3 size={20} />
                </span>
                <div>
                  <p className="font-black text-amber-900 dark:text-amber-200">
                    {stats.pending_users} account
                    {stats.pending_users === 1 ? '' : 's'} awaiting approval
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300/80">
                    These users cannot sign in until they are reviewed.
                  </p>
                </div>
              </div>

              <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-amber-700">
                Review now
                <ArrowRight size={15} />
              </span>
            </Link>
          )}

          <div className="mt-5">
            <TopShopsCard stats={stats} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            {/* ── Registration trend ───────────────────────────────── */}
            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_55px_rgba(0,0,0,0.3)] sm:p-6">
              <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Registrations
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                New shop owner signups over the last 7 days
              </p>

              <div className="mt-6 flex h-48 items-end justify-between gap-2">
                {trend.map((point) => (
                  <div
                    key={point.day}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {point.count}
                    </span>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-violet-500 transition-all"
                      style={{
                        // Zero-count days keep a 4px stub so the axis reads as
                        // a continuous week rather than a gap.
                        height: `${Math.max((point.count / maxTrend) * 150, 4)}px`,
                      }}
                      title={`${point.count} on ${point.day}`}
                    />
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
                      {point.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Recent activity ──────────────────────────────────── */}
            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_55px_rgba(0,0,0,0.3)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                    Recent activity
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Latest administrative actions
                  </p>
                </div>

                <Link
                  to="/admin/audit-logs"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
                >
                  View all
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="mt-5">
                <AuditTrailList entries={stats.recent_activity} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
