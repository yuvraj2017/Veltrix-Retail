import {
  Ban,
  CheckCircle2,
  CreditCard,
  KeyRound,
  PackageCheck,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  UserPlus,
  UserRoundCog,
  UserRoundX,
} from 'lucide-react'
import type { ReactNode } from 'react'

import type { AdminAuditAction, AdminAuditEntry } from '../../features/admin/types'

/**
 * Renders audit entries as a list of cards. Used on both the dashboard
 * (recent activity) and the audit log page, so the two never drift apart.
 */

const ACTION_META: Record<
  AdminAuditAction,
  { label: string; icon: ReactNode; chipClass: string }
> = {
  USER_REGISTERED: {
    label: 'Registered',
    icon: <UserPlus size={16} />,
    chipClass:
      'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  },
  USER_APPROVED: {
    label: 'Approved',
    icon: <CheckCircle2 size={16} />,
    chipClass:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  USER_REJECTED: {
    label: 'Rejected',
    icon: <UserRoundX size={16} />,
    chipClass: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400',
  },
  USER_SUSPENDED: {
    label: 'Suspended',
    icon: <ShieldAlert size={16} />,
    chipClass:
      'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400',
  },
  USER_REACTIVATED: {
    label: 'Reactivated',
    icon: <RotateCcw size={16} />,
    chipClass:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  USER_DISABLED: {
    label: 'Disabled',
    icon: <Ban size={16} />,
    chipClass:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  ROLE_CHANGED: {
    label: 'Role changed',
    icon: <UserRoundCog size={16} />,
    chipClass:
      'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  },
  PLAN_CHANGED: {
    label: 'Plan changed',
    icon: <PackageCheck size={16} />,
    chipClass:
      'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  },
  ENTITLEMENT_CHANGED: {
    label: 'Entitlement changed',
    icon: <SlidersHorizontal size={16} />,
    chipClass:
      'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  },
  SUBSCRIPTION_CHANGED: {
    label: 'Subscription changed',
    icon: <CreditCard size={16} />,
    chipClass:
      'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  },
  LICENSE_CHANGED: {
    label: 'License changed',
    icon: <KeyRound size={16} />,
    chipClass:
      'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  },
  SHOP_ENTITLEMENT_OVERRIDE_CHANGED: {
    label: 'Override changed',
    icon: <SlidersHorizontal size={16} />,
    chipClass:
      'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/60 dark:text-fuchsia-400',
  },
  PAYMENT_CHANGED: {
    label: 'Payment changed',
    icon: <CreditCard size={16} />,
    chipClass:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
}

const FALLBACK_META = {
  label: 'Action',
  icon: <ShieldAlert size={16} />,
  chipClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

export function auditActionLabel(action: string) {
  return ACTION_META[action as AdminAuditAction]?.label ?? action
}

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function AuditTrailList({
  entries,
  loading,
  emptyMessage = 'No administrative activity recorded yet.',
  showTarget = true,
}: {
  entries: AdminAuditEntry[]
  loading?: boolean
  emptyMessage?: string
  showTarget?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-[1.25rem] bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-[1.25rem] border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const meta = ACTION_META[entry.action] ?? FALLBACK_META

        return (
          <li
            key={entry.id}
            className="rounded-[1.25rem] border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/50"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.chipClass}`}
                >
                  {meta.icon}
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {meta.label}
                    {showTarget && entry.target_email ? (
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        {' '}
                        &middot; {entry.target_email}
                      </span>
                    ) : null}
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    by {entry.actor_email}
                  </p>

                  {entry.previous_value && entry.new_value ? (
                    <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
                        {entry.previous_value}
                      </span>
                      {' → '}
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
                        {entry.new_value}
                      </span>
                    </p>
                  ) : null}

                  {entry.reason ? (
                    <p className="mt-2 text-xs italic leading-5 text-slate-500 dark:text-slate-400">
                      &ldquo;{entry.reason}&rdquo;
                    </p>
                  ) : null}
                </div>
              </div>

              <time
                dateTime={entry.created_at}
                className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500"
              >
                {formatTimestamp(entry.created_at)}
              </time>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
