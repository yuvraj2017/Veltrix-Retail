import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCcw, ScrollText, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AuditTrailList } from '../../components/admin/AuditTrailList'
import { getAuditLogs } from '../../features/admin/api'
import type { AdminAuditAction } from '../../features/admin/types'
import { getApiErrorMessage } from '../../lib/api-error'

const PAGE_SIZE = 25

const ACTION_OPTIONS: { label: string; value: AdminAuditAction | '' }[] = [
  { label: 'All actions', value: '' },
  { label: 'Registered', value: 'USER_REGISTERED' },
  { label: 'Approved', value: 'USER_APPROVED' },
  { label: 'Rejected', value: 'USER_REJECTED' },
  { label: 'Suspended', value: 'USER_SUSPENDED' },
  { label: 'Reactivated', value: 'USER_REACTIVATED' },
  { label: 'Disabled', value: 'USER_DISABLED' },
  { label: 'Role changed', value: 'ROLE_CHANGED' },
  { label: 'Plan changed', value: 'PLAN_CHANGED' },
  { label: 'Entitlement changed', value: 'ENTITLEMENT_CHANGED' },
  { label: 'Subscription changed', value: 'SUBSCRIPTION_CHANGED' },
  { label: 'License changed', value: 'LICENSE_CHANGED' },
  { label: 'Override changed', value: 'SHOP_ENTITLEMENT_OVERRIDE_CHANGED' },
  { label: 'Payment changed', value: 'PAYMENT_CHANGED' },
]

/**
 * Administrative activity log.
 *
 * Server-side paginated and filtered -- the log grows without bound, so the
 * browser only ever holds one page.
 */
export default function AdminAuditLogsPage() {
  const queryClient = useQueryClient()

  const [action, setAction] = useState<AdminAuditAction | ''>('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [action])

  const logsQuery = useQuery({
    queryKey: ['admin', 'audit-logs', action, page],
    queryFn: () => getAuditLogs({ action, page, page_size: PAGE_SIZE }),
  })

  const entries = logsQuery.data?.items ?? []
  const total = logsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const error = logsQuery.error
    ? getApiErrorMessage(logsQuery.error, 'Unable to load the audit log')
    : ''

  return (
    <section className="mx-auto w-full max-w-[1200px] px-0 sm:px-2">
      <div className="mb-6 mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-400">
            <ShieldCheck size={13} />
            Super Admin
          </div>

          <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 dark:text-slate-100 sm:text-4xl">
            Audit Logs
          </h1>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-400 sm:mt-2">
            Every administrative action, with who performed it and when.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] })
          }
          disabled={logsQuery.isFetching}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#f0f2f7] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#e8ecf4] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          <RefreshCcw
            size={15}
            className={logsQuery.isFetching ? 'animate-spin' : undefined}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
        >
          {error}
        </div>
      )}

      <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <label className="sr-only" htmlFor="audit-action-filter">
              Filter by action
            </label>
            <select
              id="audit-action-filter"
              value={action}
              onChange={(event) =>
                setAction(event.target.value as AdminAuditAction | '')
              }
              className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <ScrollText size={13} />
            {logsQuery.isPending
              ? 'Loading...'
              : `${total} record${total === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="mt-5">
          <AuditTrailList
            entries={entries}
            loading={logsQuery.isPending}
            emptyMessage={
              action
                ? 'No records match this filter.'
                : 'No administrative activity has been recorded yet.'
            }
          />
        </div>

        {totalPages > 1 && (
          <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {page}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {totalPages}
              </span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
