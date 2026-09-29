import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Clock3,
  IndianRupee,
  Mail,
  Package,
  Phone,
  Receipt,
  ShieldCheck,
  Store,
  TrendingUp,
  UserRoundCog,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { actionsForUser, type AdminActionDescriptor } from '../../components/admin/adminActions'
import { AuditTrailList } from '../../components/admin/AuditTrailList'
import { UserActionModal } from '../../components/admin/UserActionModal'
import { UserRoleBadge, UserStatusBadge } from '../../components/admin/UserStatusBadge'
import { useToast } from '../../components/ui/ToastProvider'
import { changeUserRole, getAdminUser } from '../../features/admin/api'
import {
  formatCount,
  formatMoneyPrecise,
  profitMargin,
} from '../../features/admin/format'
import type { AdminUserDetail, UserRole } from '../../features/admin/types'
import { getApiErrorMessage } from '../../lib/api-error'

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Never'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** One trading figure. */
function MetricTile({
  label,
  value,
  icon,
  accentClass = 'text-slate-900 dark:text-slate-100',
  hint,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accentClass?: string
  hint?: string
}) {
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      </div>
      <p className={`mt-2 break-words text-xl font-bold leading-none ${accentClass}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

/** Trading performance for a shop owner. Not rendered for a platform account. */
function ShopPerformancePanel({ user }: { user: AdminUserDetail }) {
  const margin = profitMargin(user.total_revenue, user.total_profit)
  const hasSales = user.invoice_count > 0

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
          <TrendingUp size={20} />
        </span>
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Business performance
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Lifetime figures for {user.shop_name || 'this shop'}, excluding
            cancelled invoices
          </p>
        </div>
      </div>

      {!hasSales ? (
        <p className="mt-6 rounded-[1.25rem] border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          This shop has not billed anything yet.
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricTile
          label="Revenue"
          value={formatMoneyPrecise(user.total_revenue)}
          icon={<IndianRupee size={15} />}
        />
        <MetricTile
          label="Profit"
          value={formatMoneyPrecise(user.total_profit)}
          icon={<TrendingUp size={15} />}
          accentClass="text-emerald-600 dark:text-emerald-400"
          hint={margin === null ? undefined : `${margin.toFixed(1)}% margin`}
        />
        <MetricTile
          label="Collected"
          value={formatMoneyPrecise(user.collected_amount)}
          icon={<Wallet size={15} />}
        />
        <MetricTile
          label="Outstanding"
          value={formatMoneyPrecise(user.outstanding_amount)}
          icon={<Wallet size={15} />}
          accentClass={
            Number(user.outstanding_amount || 0) > 0
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-slate-900 dark:text-slate-100'
          }
        />
        <MetricTile
          label="Invoices"
          value={formatCount(user.invoice_count)}
          icon={<Receipt size={15} />}
          hint={
            user.last_invoice_date
              ? `Last sale ${formatDateTime(user.last_invoice_date)}`
              : 'No sales yet'
          }
        />
        <MetricTile
          label="Catalogue"
          value={`${formatCount(user.product_count)} products`}
          icon={<Package size={15} />}
          hint={`${formatCount(user.customer_count)} customers`}
        />
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-50 py-3 last:border-0 dark:border-slate-800/60">
      <dt className="flex shrink-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-slate-700 dark:text-slate-300">
        {value}
      </dd>
    </div>
  )
}

/**
 * Single-account view: profile, shop context, the actions currently available,
 * role assignment, and this account's audit trail.
 *
 * Which actions render is decided by `allowed_transitions` from the server, so
 * a rejected account shows no buttons at all rather than options that would be
 * refused.
 */
export default function AdminUserDetailsPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const id = Number(userId)

  const [pendingAction, setPendingAction] = useState<AdminActionDescriptor | null>(null)
  const [actionError, setActionError] = useState('')
  const [roleError, setRoleError] = useState('')

  const userQuery = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => getAdminUser(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  const user = userQuery.data

  const statusMutation = useMutation({
    mutationFn: ({
      descriptor,
      reason,
    }: {
      descriptor: AdminActionDescriptor
      reason?: string
    }) => descriptor.run(id, reason),

    onSuccess: async (_data, variables) => {
      setPendingAction(null)
      setActionError('')
      showToast({
        title: 'Admin action applied',
        message: `${variables.descriptor.label} applied successfully.`,
        variant: 'success',
      })
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
    },

    onError: (error) => {
      setActionError(getApiErrorMessage(error, 'Unable to complete this action'))
    },
  })

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) => changeUserRole(id, role),

    onSuccess: async (data) => {
      setRoleError('')
      showToast({
        title: 'Role updated',
        message: data.message,
        variant: 'success',
      })
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
    },

    onError: (error) => {
      setRoleError(getApiErrorMessage(error, 'Unable to change the role'))
    },
  })

  if (userQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-5 py-4">
        <div className="h-10 w-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-40 animate-pulse rounded-[2rem] bg-white shadow-sm dark:bg-slate-800" />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-[2rem] bg-white shadow-sm dark:bg-slate-800" />
          <div className="h-80 animate-pulse rounded-[2rem] bg-white shadow-sm dark:bg-slate-800" />
        </div>
      </div>
    )
  }

  if (userQuery.error || !user) {
    return (
      <div className="mx-auto w-full max-w-[720px] py-10 text-center">
        <p className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {getApiErrorMessage(userQuery.error, 'This user could not be loaded.')}
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/users')}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <ArrowLeft size={15} />
          Back to users
        </button>
      </div>
    )
  }

  const availableActions = actionsForUser(user.status, user.allowed_transitions)
  const nextRole: UserRole = user.role === 'super_admin' ? 'owner' : 'super_admin'

  return (
    <section className="mx-auto w-full max-w-[1200px] px-0 sm:px-2">
      <Link
        to="/admin/users"
        className="mb-5 mt-2 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] transition hover:-translate-y-[1px] hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800/75 dark:text-slate-300 dark:hover:text-indigo-400"
      >
        <ArrowLeft size={16} />
        Back to Users
      </Link>

      {/* ── Identity header ─────────────────────────────────────────── */}
      <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white sm:text-3xl">
              {user.full_name}
            </h1>
            <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <UserStatusBadge status={user.status} />
              <UserRoleBadge role={user.role} />
            </div>
          </div>

          {/* Actions valid for this account's current state. */}
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {availableActions.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                No further status changes are possible
              </p>
            ) : (
              availableActions.map((descriptor) => (
                <button
                  key={descriptor.action}
                  type="button"
                  onClick={() => {
                    setActionError('')
                    setPendingAction(descriptor)
                  }}
                  disabled={statusMutation.isPending}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    descriptor.destructive
                      ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500'
                  }`}
                >
                  {descriptor.label}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Administrator-only context for why this account is in its state. */}
        {user.status_reason && (
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
              Administrator note
            </p>
            <p className="mt-1 text-sm italic leading-6 text-amber-800 dark:text-amber-300/90">
              &ldquo;{user.status_reason}&rdquo;
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Account details ──────────────────────────────────────── */}
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            Account
          </h2>

          <dl className="mt-4">
            <InfoRow label="Email" value={user.email} icon={<Mail size={12} />} />
            <InfoRow label="Phone" value={user.phone || '--'} icon={<Phone size={12} />} />
            <InfoRow label="Registered" value={formatDateTime(user.created_at)} icon={<Clock3 size={12} />} />
            <InfoRow label="Last login" value={formatDateTime(user.last_login_at)} />
            <InfoRow label="Status changed" value={formatDateTime(user.status_changed_at)} />
            <InfoRow label="Timezone" value={user.timezone || '--'} />
            <InfoRow label="Language" value={user.language || '--'} />
          </dl>

          {/* A platform administrator owns no shop, so there is nothing to
              show here rather than a column of dashes. */}
          {user.has_shop ? (
            <>
              <h2 className="mt-7 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Shop
              </h2>

              <dl className="mt-4">
                <InfoRow label="Name" value={user.shop_name || '--'} icon={<Store size={12} />} />
                <InfoRow label="Category" value={user.shop_category || '--'} />
                <InfoRow label="Email" value={user.shop_email || '--'} />
                <InfoRow label="Phone" value={user.shop_phone || '--'} />
                <InfoRow label="Address" value={user.shop_address || '--'} />
              </dl>
            </>
          ) : (
            <div className="mt-7 rounded-[1.25rem] border border-indigo-100 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/40">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
                <ShieldCheck size={13} />
                Platform account
              </p>
              <p className="mt-1.5 text-sm leading-6 text-indigo-800 dark:text-indigo-300/90">
                This account operates the platform and does not own a shop, so it
                has no catalogue, customers or sales of its own.
              </p>
            </div>
          )}

          {/* ── Role assignment ────────────────────────────────────── */}
          <div className="mt-7 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400">
                <UserRoundCog size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                  Role
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {user.can_change_role
                    ? `Currently ${
                        user.role === 'super_admin' ? 'a super admin' : 'a shop owner'
                      }. Super admins can manage every account on the platform.`
                    : 'This role cannot be changed here — an administrator cannot change their own role, and the last remaining super admin cannot be demoted.'}
                </p>
              </div>
            </div>

            {user.can_change_role && (
              <button
                type="button"
                onClick={() => {
                  setRoleError('')
                  roleMutation.mutate(nextRole)
                }}
                disabled={roleMutation.isPending}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-400 dark:hover:bg-slate-800 sm:w-auto"
              >
                <ShieldCheck size={15} />
                {roleMutation.isPending
                  ? 'Updating...'
                  : nextRole === 'super_admin'
                    ? 'Promote to Super Admin'
                    : 'Demote to Owner'}
              </button>
            )}

            {roleError && (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
              >
                {roleError}
              </p>
            )}
          </div>
        </div>

        {/* ── Performance + audit trail ────────────────────────────── */}
        <div className="space-y-5">
        {user.has_shop ? <ShopPerformancePanel user={user} /> : null}

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            History
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Administrative actions taken on this account
          </p>

          <div className="mt-5">
            <AuditTrailList
              entries={user.audit_trail}
              showTarget={false}
              emptyMessage="Nothing has been recorded for this account yet."
            />
          </div>
        </div>
        </div>
      </div>

      <UserActionModal
        descriptor={pendingAction}
        userName={user.full_name}
        loading={statusMutation.isPending}
        error={actionError}
        onClose={() => {
          setPendingAction(null)
          setActionError('')
        }}
        onConfirm={(reason) => {
          if (!pendingAction) return
          statusMutation.mutate({ descriptor: pendingAction, reason })
        }}
      />
    </section>
  )
}
