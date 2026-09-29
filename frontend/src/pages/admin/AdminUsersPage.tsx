import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Filter, Search, ShieldCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AdminUsersTable } from '../../components/admin/AdminUsersTable'
import type { AdminActionDescriptor } from '../../components/admin/adminActions'
import { UserActionModal } from '../../components/admin/UserActionModal'
import { useToast } from '../../components/ui/ToastProvider'
import { getAdminUsers } from '../../features/admin/api'
import type {
  AdminUserListItem,
  UserRole,
  UserStatus,
} from '../../features/admin/types'
import { getApiErrorMessage } from '../../lib/api-error'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { label: string; value: UserStatus | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Disabled', value: 'disabled' },
]

const ROLE_OPTIONS: { label: string; value: UserRole | '' }[] = [
  { label: 'All roles', value: '' },
  { label: 'Owner', value: 'owner' },
  { label: 'Super Admin', value: 'super_admin' },
]

const SORT_OPTIONS = [
  { label: 'Newest first', value: 'created_desc' },
  { label: 'Oldest first', value: 'created_asc' },
  { label: 'Name (A-Z)', value: 'name_asc' },
  { label: 'Name (Z-A)', value: 'name_desc' },
  { label: 'Recently active', value: 'last_login_desc' },
]

const isUserStatus = (value: string | null): value is UserStatus =>
  !!value && STATUS_OPTIONS.some((option) => option.value === value && value !== '')

/**
 * User directory and approval queue.
 *
 * The status filter is held in the URL so that "Pending Approvals" is a real
 * link (from the sidebar and the dashboard tiles) and so a filtered view can
 * be bookmarked or shared. Everything else is local state.
 */
export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFromUrl = searchParams.get('status')
  const status: UserStatus | '' = isUserStatus(statusFromUrl) ? statusFromUrl : ''

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [sortBy, setSortBy] = useState('created_desc')
  const [page, setPage] = useState(1)

  const [pendingAction, setPendingAction] = useState<{
    user: AdminUserListItem
    descriptor: AdminActionDescriptor
  } | null>(null)
  const [actionError, setActionError] = useState('')

  // Debounce drives the query key, so typing does not spawn a cache entry per
  // intermediate keystroke -- same approach as ProductsPage.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, role, sortBy])

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', debouncedSearch, status, role, sortBy, page],
    queryFn: () =>
      getAdminUsers({
        search: debouncedSearch,
        status,
        role,
        sort_by: sortBy,
        page,
        page_size: PAGE_SIZE,
      }),
  })

  const actionMutation = useMutation({
    mutationFn: ({
      descriptor,
      userId,
      reason,
    }: {
      descriptor: AdminActionDescriptor
      userId: number
      reason?: string
    }) => descriptor.run(userId, reason),

    onSuccess: async (_data, variables) => {
      const name = pendingAction?.user.full_name ?? 'User'
      setPendingAction(null)
      setActionError('')
      showToast({
        title: 'Admin action applied',
        message: `${name} - ${variables.descriptor.label.toLowerCase()} applied.`,
        variant: 'success',
      })

      // Refetch the list AND the dashboard counts: both are now stale.
      await queryClient.invalidateQueries({ queryKey: ['admin'] })
    },

    onError: (error) => {
      // Kept in the dialog rather than dismissing it, so the administrator can
      // read what went wrong next to the action they attempted.
      setActionError(getApiErrorMessage(error, 'Unable to complete this action'))
    },
  })

  const users = usersQuery.data?.items ?? []
  const total = usersQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const loadError = usersQuery.error
    ? getApiErrorMessage(usersQuery.error, 'Unable to load users')
    : ''

  const heading = useMemo(() => {
    if (status === 'pending') return 'Pending Approvals'
    if (status) return `${status.charAt(0).toUpperCase()}${status.slice(1)} Users`
    return 'All Users'
  }, [status])

  const handleStatusChange = (value: UserStatus | '') => {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set('status', value)
    } else {
      next.delete('status')
    }
    setSearchParams(next, { replace: true })
  }

  const selectClass =
    'h-12 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950'

  return (
    <section className="mx-auto w-full max-w-[1600px] px-0 sm:px-2">
      <div className="mb-6 mt-2">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-400">
          <ShieldCheck size={13} />
          Super Admin
        </div>

        <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 dark:text-slate-100 sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-1 text-base text-slate-600 dark:text-slate-400 sm:mt-2">
          {status === 'pending'
            ? 'These accounts cannot sign in until they are approved.'
            : 'Search, review and manage access for every registered account.'}
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
        >
          {loadError}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="mb-5 rounded-[2rem] border border-slate-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500"
            />
            <label className="sr-only" htmlFor="admin-user-search">
              Search users
            </label>
            <input
              id="admin-user-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, phone or shop..."
              className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
            />
          </div>

          <div>
            <label className="sr-only" htmlFor="admin-status-filter">
              Filter by status
            </label>
            <select
              id="admin-status-filter"
              value={status}
              onChange={(event) =>
                handleStatusChange(event.target.value as UserStatus | '')
              }
              className={selectClass}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="sr-only" htmlFor="admin-role-filter">
              Filter by role
            </label>
            <select
              id="admin-role-filter"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole | '')}
              className={selectClass}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="sr-only" htmlFor="admin-sort">
              Sort
            </label>
            <select
              id="admin-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className={selectClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Filter size={13} />
          {usersQuery.isPending ? 'Loading...' : `${total} user${total === 1 ? '' : 's'} matched`}
        </p>
      </div>

      <AdminUsersTable
        users={users}
        loading={usersQuery.isPending}
        busyUserId={actionMutation.isPending ? pendingAction?.user.id ?? null : null}
        emptyTitle={status === 'pending' ? 'No pending approvals' : 'No users found'}
        emptyDescription={
          status === 'pending'
            ? 'Every registration has been reviewed. New signups will appear here.'
            : 'Try adjusting the search or filters above.'
        }
        onAction={(user, descriptor) => {
          setActionError('')
          setPendingAction({ user, descriptor })
        }}
      />

      {/* Pagination appears only when it is needed. */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-800 sm:flex-row">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{total}</span>
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

            <span className="px-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {page} / {totalPages}
            </span>

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

      {/* Empty-state hint when the directory itself is empty. */}
      {!usersQuery.isPending && total === 0 && !status && !debouncedSearch && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500">
          <Users size={14} />
          No accounts have been registered yet.
        </p>
      )}

      <UserActionModal
        descriptor={pendingAction?.descriptor ?? null}
        userName={pendingAction?.user.full_name ?? ''}
        loading={actionMutation.isPending}
        error={actionError}
        onClose={() => {
          setPendingAction(null)
          setActionError('')
        }}
        onConfirm={(reason) => {
          if (!pendingAction) return
          actionMutation.mutate({
            descriptor: pendingAction.descriptor,
            userId: pendingAction.user.id,
            reason,
          })
        }}
      />
    </section>
  )
}
