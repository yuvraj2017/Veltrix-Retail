import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  BriefcaseBusiness,
  Edit3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  BranchAccessDialog,
  CreateStaffDialog,
  EditRoleDialog,
  OwnershipTransferDialog,
  StatusConfirmDialog,
} from '../components/staff/StaffDialogs'
import { useToast } from '../components/ui/ToastProvider'
import { useAuth } from '../context/AuthContext'
import {
  createStaff,
  grantStaffBranch,
  listStaff,
  revokeStaffBranch,
  transferOwnership,
  updateStaff,
} from '../features/staff/api'
import {
  assignableRolesFor,
  canManageStaffTarget,
  formatRole,
  PERMISSIONS,
} from '../features/staff/constants'
import type {
  AssignableStaffRole,
  MembershipStatus,
  StaffCreatePayload,
  StaffMember,
} from '../features/staff/types'
import { getApiErrorMessage } from '../lib/api-error'

const STAFF_QUERY_KEY = ['organization', 'current', 'staff'] as const

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'active'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${role === 'owner' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
      {formatRole(role)}
    </span>
  )
}

type StaffActionsProps = {
  staff: StaffMember
  manageable: boolean
  onEdit: (staff: StaffMember) => void
  onStatus: (staff: StaffMember) => void
  onBranches: (staff: StaffMember) => void
}

function StaffActions({ staff, manageable, onEdit, onStatus, onBranches }: StaffActionsProps) {
  if (staff.role === 'owner') {
    return <span className="text-xs font-semibold text-slate-400">Protected owner</span>
  }
  if (!manageable) return <span className="text-xs font-semibold text-slate-400">View only</span>
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onEdit(staff)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200" aria-label={`Edit ${staff.full_name}`}>
        <Edit3 size={15} /> Role
      </button>
      <button type="button" onClick={() => onBranches(staff)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200" aria-label={`Manage branches for ${staff.full_name}`}>
        <MapPin size={15} /> Branches
      </button>
      <button type="button" onClick={() => onStatus(staff)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold ${staff.membership_status === 'active' ? 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300' : 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300'}`}>
        {staff.membership_status === 'active' ? <UserRoundX size={15} /> : <UserCheck size={15} />}
        {staff.membership_status === 'active' ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  )
}

export default function StaffPage() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { user, shop, hasPermission, refreshMe } = useAuth()
  const canManage = hasPermission(PERMISSIONS.staffManage)
  const canTransfer = hasPermission(PERMISSIONS.ownershipTransfer)
  const assignableRoles = assignableRolesFor(user?.membership_role)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | MembershipStatus>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [statusStaff, setStatusStaff] = useState<StaffMember | null>(null)
  const [branchStaff, setBranchStaff] = useState<StaffMember | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [pendingBranchId, setPendingBranchId] = useState<number | null>(null)

  const staffQuery = useQuery({ queryKey: STAFF_QUERY_KEY, queryFn: listStaff })
  const staff = staffQuery.data ?? []

  const availableBranches = useMemo(() => {
    const values = new Map<number, string>()
    for (const member of staff) {
      for (const branch of member.branches) values.set(branch.shop_id, branch.shop_name)
    }
    if (shop?.id) values.set(shop.id, shop.name || user?.shop_name || `Branch ${shop.id}`)
    return Array.from(values, ([shop_id, shop_name]) => ({ shop_id, shop_name })).sort((a, b) => a.shop_name.localeCompare(b.shop_name))
  }, [shop, staff, user?.shop_name])

  const filteredStaff = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return staff.filter((member) => {
      const matchesSearch = !needle || [member.full_name, member.email, formatRole(member.role), ...member.branches.map((branch) => branch.shop_name)].some((value) => value.toLowerCase().includes(needle))
      return matchesSearch && (statusFilter === 'all' || member.membership_status === statusFilter)
    })
  }, [search, staff, statusFilter])

  const transferCandidates = useMemo(
    () => staff.filter((member) => member.user_id !== user?.id && member.membership_status === 'active' && member.account_status === 'active' && member.role !== 'owner' && member.branches.some((branch) => branch.status === 'active' && branch.is_current)),
    [staff, user?.id],
  )

  const refreshStaff = () => queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEY })
  const mutationError = (error: unknown, fallback: string) => showToast({ variant: 'error', title: 'Unable to complete action', message: getApiErrorMessage(error, fallback) })

  const createMutation = useMutation({ mutationFn: createStaff })
  const updateMutation = useMutation({ mutationFn: ({ membershipId, payload }: { membershipId: number; payload: { role?: AssignableStaffRole; status?: MembershipStatus } }) => updateStaff(membershipId, payload) })
  const grantMutation = useMutation({ mutationFn: ({ membershipId, shopId }: { membershipId: number; shopId: number }) => grantStaffBranch(membershipId, shopId) })
  const revokeMutation = useMutation({ mutationFn: ({ membershipId, shopId }: { membershipId: number; shopId: number }) => revokeStaffBranch(membershipId, shopId) })
  const transferMutation = useMutation({ mutationFn: transferOwnership })

  const submitCreate = async (payload: StaffCreatePayload) => {
    try {
      await createMutation.mutateAsync(payload)
      await refreshStaff()
      setCreateOpen(false)
      showToast({ variant: 'success', title: 'Staff created', message: `${payload.full_name} can now access assigned branches.` })
    } catch (error) {
      mutationError(error, 'Unable to create staff member.')
    }
  }

  const submitRole = async (role: AssignableStaffRole) => {
    if (!editingStaff) return
    try {
      await updateMutation.mutateAsync({ membershipId: editingStaff.membership_id, payload: { role } })
      await refreshStaff()
      setEditingStaff(null)
      showToast({ variant: 'success', title: 'Role changed', message: `${editingStaff.full_name} is now ${formatRole(role)}.` })
    } catch (error) {
      mutationError(error, 'Unable to change this role.')
    }
  }

  const submitStatus = async () => {
    if (!statusStaff) return
    const status: MembershipStatus = statusStaff.membership_status === 'active' ? 'inactive' : 'active'
    try {
      await updateMutation.mutateAsync({ membershipId: statusStaff.membership_id, payload: { status } })
      await refreshStaff()
      setStatusStaff(null)
      showToast({ variant: 'success', title: status === 'active' ? 'Access activated' : 'Access deactivated', message: `${statusStaff.full_name}'s business access is ${status}.` })
    } catch (error) {
      mutationError(error, 'Unable to update staff access.')
    }
  }

  const changeBranch = async (shopId: number, grant: boolean) => {
    if (!branchStaff) return
    setPendingBranchId(shopId)
    try {
      const updated = grant
        ? await grantMutation.mutateAsync({ membershipId: branchStaff.membership_id, shopId })
        : await revokeMutation.mutateAsync({ membershipId: branchStaff.membership_id, shopId })
      setBranchStaff(updated)
      await refreshStaff()
      showToast({ variant: 'success', title: grant ? 'Branch granted' : 'Branch revoked', message: `${updated.full_name}'s branch access was updated.` })
    } catch (error) {
      mutationError(error, 'Unable to update branch access.')
      await refreshStaff()
    } finally {
      setPendingBranchId(null)
    }
  }

  const submitTransfer = async (membershipId: number) => {
    try {
      const result = await transferMutation.mutateAsync(membershipId)
      await refreshStaff()
      await refreshMe()
      setTransferOpen(false)
      showToast({ variant: 'success', title: 'Ownership transferred', message: `${result.new_owner.full_name} is now the business owner. Your role is now Admin.` })
    } catch (error) {
      mutationError(error, 'Unable to transfer ownership.')
      await refreshStaff()
    }
  }

  const manageable = (member: StaffMember) => canManage && canManageStaffTarget(user?.membership_role, user?.id, member)
  const activeCount = staff.filter((member) => member.membership_status === 'active').length

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 py-5 sm:py-7" data-testid="staff-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Business access</p>
          <h1 className="mt-1 break-words text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Staff Management</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Manage roles, account access, and branch assignments for your organization.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canTransfer && user?.membership_role === 'owner' ? (
            <button type="button" onClick={() => setTransferOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-bold text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300">
              <ArrowRightLeft size={17} /> Transfer ownership
            </button>
          ) : null}
          {canManage ? (
            <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
              <Plus size={18} /> Add staff
            </button>
          ) : null}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Staff summary">
        {[
          ['Team members', staff.length, Users],
          ['Active access', activeCount, UserCheck],
          ['Branches', availableBranches.length, MapPin],
          ['Your role', formatRole(user?.membership_role || ''), ShieldCheck],
        ].map(([label, value, Icon]) => {
          const SummaryIcon = Icon as typeof Users
          return (
            <div key={String(label)} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <SummaryIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
              <p className="mt-3 truncate text-xs font-bold uppercase text-slate-500">{label as string}</p>
              <p className="mt-1 break-words text-xl font-black text-slate-950 dark:text-white">{String(value)}</p>
            </div>
          )
        })}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff, email, role, or branch" aria-label="Search staff" className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-indigo-950" />
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | MembershipStatus)} aria-label="Filter by staff status" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:flex-none">
              <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
            <button type="button" onClick={() => staffQuery.refetch()} disabled={staffQuery.isFetching} aria-label="Refresh staff" title="Refresh staff" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">
              <RefreshCw size={17} className={staffQuery.isFetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {staffQuery.isPending ? (
          <div className="space-y-3 p-4" aria-label="Loading staff" aria-busy="true">{[0, 1, 2].map((key) => <div key={key} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div>
        ) : staffQuery.isError ? (
          <div className="p-8 text-center"><p className="font-bold text-rose-700 dark:text-rose-300">{getApiErrorMessage(staffQuery.error, 'Unable to load staff.')}</p><button type="button" onClick={() => staffQuery.refetch()} className="mt-4 min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white">Try again</button></div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center"><BriefcaseBusiness className="mx-auto text-slate-400" /><h2 className="mt-3 font-black text-slate-900 dark:text-white">No staff match this view</h2><p className="mt-1 text-sm text-slate-500">Adjust the filters or add the first team member beyond the owner.</p></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block" data-testid="staff-desktop-table">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Staff member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Branch access</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredStaff.map((member) => (
                    <tr key={member.membership_id} className="align-top">
                      <td className="px-4 py-4"><p className="max-w-[240px] break-words font-black text-slate-950 dark:text-white">{member.full_name}</p><p className="mt-1 max-w-[260px] break-all text-xs text-slate-500">{member.email}</p></td>
                      <td className="px-4 py-4"><RoleBadge role={member.role} /></td>
                      <td className="px-4 py-4"><StatusBadge status={member.membership_status} />{member.account_status !== 'active' ? <p className="mt-2 text-xs font-bold text-rose-600">Account {member.account_status}</p> : null}</td>
                      <td className="px-4 py-4"><div className="max-w-[220px] space-y-1">{member.branches.map((branch) => <p key={branch.shop_id} className="break-words text-xs font-semibold text-slate-600 dark:text-slate-300">{branch.shop_name}{branch.is_current ? ' (active)' : ''}</p>)}</div></td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-500">{formatDate(member.updated_at)}</td>
                      <td className="px-4 py-4"><StaffActions staff={member} manageable={manageable(member)} onEdit={setEditingStaff} onStatus={setStatusStaff} onBranches={setBranchStaff} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 md:grid-cols-2 lg:hidden" data-testid="staff-mobile-cards">
              {filteredStaff.map((member) => (
                <article key={member.membership_id} className="min-w-0 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-black text-slate-950 dark:text-white">{member.full_name}</h2><p className="mt-1 break-all text-xs text-slate-500">{member.email}</p></div><StatusBadge status={member.membership_status} /></div>
                  <div className="mt-3"><RoleBadge role={member.role} /></div>
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><p className="text-xs font-black uppercase text-slate-400">Branch access</p>{member.branches.map((branch) => <p key={branch.shop_id} className="mt-1 break-words text-sm font-semibold text-slate-700 dark:text-slate-200">{branch.shop_name}{branch.is_current ? ' (active)' : ''}</p>)}</div>
                  <div className="mt-4"><StaffActions staff={member} manageable={manageable(member)} onEdit={setEditingStaff} onStatus={setStatusStaff} onBranches={setBranchStaff} /></div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {staff.length === 1 && staff[0]?.role === 'owner' ? <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500 dark:border-slate-700">Only the owner is configured. Add staff when the team is ready.</p> : null}

      <CreateStaffDialog open={createOpen} roles={assignableRoles} branches={availableBranches} pending={createMutation.isPending} onClose={() => !createMutation.isPending && setCreateOpen(false)} onSubmit={submitCreate} />
      <EditRoleDialog staff={editingStaff} roles={assignableRoles} pending={updateMutation.isPending} onClose={() => !updateMutation.isPending && setEditingStaff(null)} onSubmit={submitRole} />
      <StatusConfirmDialog staff={statusStaff} pending={updateMutation.isPending} onClose={() => !updateMutation.isPending && setStatusStaff(null)} onConfirm={submitStatus} />
      <BranchAccessDialog staff={branchStaff} branches={availableBranches} pendingShopId={pendingBranchId} onClose={() => pendingBranchId === null && setBranchStaff(null)} onGrant={(shopId) => changeBranch(shopId, true)} onRevoke={(shopId) => changeBranch(shopId, false)} />
      <OwnershipTransferDialog open={transferOpen} currentOwnerName={user?.full_name || 'Current owner'} candidates={transferCandidates} pending={transferMutation.isPending} onClose={() => !transferMutation.isPending && setTransferOpen(false)} onTransfer={submitTransfer} />
    </div>
  )
}

