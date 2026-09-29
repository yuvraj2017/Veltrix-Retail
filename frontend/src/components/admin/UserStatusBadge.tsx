import type { UserRole, UserStatus } from '../../features/admin/types'

/**
 * Status pill. Follows the same shape and weight as VendorStatusBadge so the
 * admin screens read as part of the same product.
 */

const STATUS_STYLES: Record<string, string> = {
  pending:
    'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)]',
  active:
    'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shadow-[inset_0_0_0_1px_rgba(5,150,105,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(5,150,105,0.25)]',
  suspended:
    'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 shadow-[inset_0_0_0_1px_rgba(234,88,12,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(234,88,12,0.25)]',
  rejected:
    'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(220,38,38,0.25)]',
  disabled:
    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shadow-[inset_0_0_0_1px_rgba(71,85,105,0.12)] dark:shadow-[inset_0_0_0_1px_rgba(71,85,105,0.30)]',
}

export function UserStatusBadge({ status }: { status: UserStatus | string }) {
  const normalized = String(status || '').toLowerCase()

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black capitalize ${
        STATUS_STYLES[normalized] || STATUS_STYLES.disabled
      }`}
    >
      {normalized || 'unknown'}
    </span>
  )
}

const ROLE_STYLES: Record<string, string> = {
  super_admin:
    'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 shadow-[inset_0_0_0_1px_rgba(79,70,229,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(79,70,229,0.25)]',
  owner:
    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shadow-[inset_0_0_0_1px_rgba(71,85,105,0.12)] dark:shadow-[inset_0_0_0_1px_rgba(71,85,105,0.30)]',
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
}

export function UserRoleBadge({ role }: { role: UserRole | string }) {
  const normalized = String(role || '').toLowerCase()

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${
        ROLE_STYLES[normalized] || ROLE_STYLES.owner
      }`}
    >
      {ROLE_LABELS[normalized] || normalized || 'unknown'}
    </span>
  )
}
