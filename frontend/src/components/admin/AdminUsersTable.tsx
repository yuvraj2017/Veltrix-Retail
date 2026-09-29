import { Eye, ShieldCheck, UserX } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  formatCount,
  formatDate,
  formatMoney,
  formatMoneyPrecise,
} from '../../features/admin/format'
import type { AdminUserListItem } from '../../features/admin/types'
import { actionsForUser, type AdminActionDescriptor } from './adminActions'
import { UserRoleBadge, UserStatusBadge } from './UserStatusBadge'

type AdminUsersTableProps = {
  users: AdminUserListItem[]
  loading: boolean
  busyUserId: number | null
  emptyTitle?: string
  emptyDescription?: string
  onAction: (user: AdminUserListItem, descriptor: AdminActionDescriptor) => void
}

/** Compact action buttons, shared by the desktop row and the mobile card. */
function ActionButtons({
  user,
  busy,
  onAction,
}: {
  user: AdminUserListItem
  busy: boolean
  onAction: (user: AdminUserListItem, descriptor: AdminActionDescriptor) => void
}) {
  // Only actions the server says are legal for this account's current state.
  const actions = actionsForUser(user.status, user.allowed_transitions)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to={`/admin/users/${user.id}`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
      >
        <Eye size={14} />
        View
      </Link>

      {actions.map((descriptor) => (
        <button
          key={descriptor.action}
          type="button"
          onClick={() => onAction(user, descriptor)}
          disabled={busy}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            descriptor.destructive
              ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-950'
          }`}
        >
          {descriptor.label}
        </button>
      ))}
    </div>
  )
}

/** Platform administrators have no shop, so they get a marker instead of zeros. */
function PlatformOwnerCell() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
      <ShieldCheck size={13} />
      Platform account
    </span>
  )
}

export function AdminUsersTable({
  users,
  loading,
  busyUserId,
  emptyTitle = 'No users found',
  emptyDescription = 'Try adjusting the search or filters above.',
  onAction,
}: AdminUsersTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[1.75rem] bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400 dark:shadow-none">
          <UserX size={28} />
        </div>
        <h3 className="mt-5 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">
          {emptyTitle}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          {emptyDescription}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_55px_rgba(0,0,0,0.3)]">
      {/* ── Desktop: full table ──────────────────────────────────────── */}
      <div className="hidden xl:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {[
                'Shop Owner',
                'Shop',
                'Status',
                'Revenue',
                'Profit',
                'Outstanding',
                'Sales',
                'Actions',
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
              >
                <td className="px-4 py-4">
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {user.full_name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {user.email}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                    Joined {formatDate(user.created_at)}
                  </p>
                </td>

                <td className="px-4 py-4">
                  {user.has_shop ? (
                    <>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {user.shop_name || '--'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {formatCount(user.product_count)} products &middot;{' '}
                        {formatCount(user.customer_count)} customers
                      </p>
                    </>
                  ) : (
                    <PlatformOwnerCell />
                  )}
                </td>

                <td className="px-4 py-4">
                  <UserStatusBadge status={user.status} />
                  <div className="mt-1.5">
                    <UserRoleBadge role={user.role} />
                  </div>
                </td>

                <td className="px-4 py-4">
                  {user.has_shop ? (
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {formatMoney(user.total_revenue)}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">--</span>
                  )}
                </td>

                <td className="px-4 py-4">
                  {user.has_shop ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(user.total_profit)}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">--</span>
                  )}
                </td>

                <td className="px-4 py-4">
                  {!user.has_shop ? (
                    <span className="text-slate-300 dark:text-slate-600">--</span>
                  ) : Number(user.outstanding_amount || 0) > 0 ? (
                    <span className="font-semibold text-orange-600 dark:text-orange-400">
                      {formatMoney(user.outstanding_amount)}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      Nothing due
                    </span>
                  )}
                </td>

                <td className="px-4 py-4">
                  {user.has_shop ? (
                    <>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {formatCount(user.invoice_count)} invoices
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {user.last_invoice_date
                          ? `Last ${formatDate(user.last_invoice_date)}`
                          : 'No sales yet'}
                      </p>
                    </>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">--</span>
                  )}
                </td>

                <td className="px-4 py-4">
                  <ActionButtons
                    user={user}
                    busy={busyUserId === user.id}
                    onAction={onAction}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Tablet / mobile: stacked cards ───────────────────────────────
          An eight-column table cannot be made usable by letting it scroll
          sideways, so below xl each row becomes a card carrying the same
          information and the same actions. */}
      <div className="space-y-4 p-4 xl:hidden">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-900 dark:text-slate-100">
                  {user.full_name}
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                  {user.email}
                </p>
              </div>
              <UserStatusBadge status={user.status} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <UserRoleBadge role={user.role} />
              {user.has_shop ? (
                <span className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {user.shop_name || 'No shop name'}
                </span>
              ) : (
                <PlatformOwnerCell />
              )}
            </div>

            {user.has_shop && (
              <>
                {/* Money first: it is what a platform operator scans for. */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-[1rem] bg-slate-50 p-3 dark:bg-slate-900/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Revenue
                    </p>
                    <p className="mt-1 text-lg font-bold leading-none text-slate-900 dark:text-slate-100">
                      {formatMoney(user.total_revenue)}
                    </p>
                  </div>

                  <div className="rounded-[1rem] bg-slate-50 p-3 dark:bg-slate-900/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Profit
                    </p>
                    <p className="mt-1 text-lg font-bold leading-none text-emerald-600 dark:text-emerald-400">
                      {formatMoney(user.total_profit)}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Outstanding
                    </dt>
                    <dd
                      className={`mt-1 font-semibold ${
                        Number(user.outstanding_amount || 0) > 0
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {formatMoneyPrecise(user.outstanding_amount)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Invoices
                    </dt>
                    <dd className="mt-1 text-slate-700 dark:text-slate-300">
                      {formatCount(user.invoice_count)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Catalogue
                    </dt>
                    <dd className="mt-1 text-slate-700 dark:text-slate-300">
                      {formatCount(user.product_count)} products
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Last sale
                    </dt>
                    <dd className="mt-1 text-slate-700 dark:text-slate-300">
                      {user.last_invoice_date
                        ? formatDate(user.last_invoice_date)
                        : 'None'}
                    </dd>
                  </div>
                </dl>
              </>
            )}

            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Joined {formatDate(user.created_at)}
              {user.last_login_at ? ` · Last login ${formatDate(user.last_login_at)}` : ' · Never signed in'}
            </p>

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
              <ActionButtons
                user={user}
                busy={busyUserId === user.id}
                onAction={onAction}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
