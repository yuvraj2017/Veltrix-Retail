import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ROLE_LABELS } from '../../features/staff/constants'
import type {
  AssignableStaffRole,
  StaffBranchAccess,
  StaffCreatePayload,
  StaffMember,
} from '../../features/staff/types'

type BranchOption = Pick<StaffBranchAccess, 'shop_id' | 'shop_name'>

const inputClass =
  'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-950'

function DialogFrame({
  open,
  title,
  description,
  icon,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-xl',
}: {
  open: boolean
  title: string
  description: string
  icon: ReactNode
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-dialog-title"
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[88vh] sm:rounded-lg ${maxWidth}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {icon}
            </span>
            <div className="min-w-0">
              <h2 id="staff-dialog-title" className="text-lg font-black text-slate-950 dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950 sm:px-6">
          {footer}
        </footer>
      </section>
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
      {label}
      <span className="mt-2 block">{children}</span>
      {hint ? <span className="mt-1.5 block text-xs font-medium text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function CreateStaffDialog({
  open,
  roles,
  branches,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean
  roles: AssignableStaffRole[]
  branches: BranchOption[]
  pending: boolean
  onClose: () => void
  onSubmit: (payload: StaffCreatePayload) => Promise<void>
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<AssignableStaffRole>('manager')
  const [branchIds, setBranchIds] = useState<number[]>([])
  const [defaultShopId, setDefaultShopId] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setPassword('')
      setShowPassword(false)
      return
    }
    const firstRole = roles[0] ?? 'manager'
    const firstBranch = branches[0]?.shop_id ?? null
    setFullName('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setRole(firstRole)
    setBranchIds(firstBranch ? [firstBranch] : [])
    setDefaultShopId(firstBranch)
    setError('')
  }, [open, roles, branches])

  const toggleBranch = (shopId: number) => {
    setBranchIds((current) => {
      if (current.includes(shopId)) {
        if (current.length === 1) return current
        const next = current.filter((id) => id !== shopId)
        if (defaultShopId === shopId) setDefaultShopId(next[0] ?? null)
        return next
      }
      const next = [...current, shopId]
      if (!defaultShopId) setDefaultShopId(shopId)
      return next
    })
  }

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 8 || !defaultShopId || !branchIds.length) {
      setError('Complete all required fields. The initial password must be at least 8 characters.')
      return
    }
    setError('')
    await onSubmit({
      full_name: fullName.trim(),
      email: email.trim(),
      initial_password: password,
      role,
      branch_ids: branchIds,
      default_shop_id: defaultShopId,
    })
  }

  return (
    <DialogFrame
      open={open}
      title="Add staff member"
      description="Create a business account with an initial role and branch access."
      icon={<UserPlus size={20} />}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">Cancel</button>
          <button type="button" onClick={submit} disabled={pending || roles.length === 0 || branches.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Create staff
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input autoFocus autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Initial password" hint="At least 8 characters. It is never stored in this browser.">
          <span className="relative block">
            <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} pr-12`} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </Field>
        <Field label="Role">
          <select value={role} onChange={(event) => setRole(event.target.value as AssignableStaffRole)} className={inputClass}>
            {roles.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
          </select>
        </Field>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-slate-700 dark:text-slate-200">Branch access</legend>
        <div className="mt-2 space-y-2">
          {branches.map((branch) => {
            const assigned = branchIds.includes(branch.shop_id)
            return (
              <div key={branch.shop_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <label className="flex min-w-0 items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <input type="checkbox" checked={assigned} onChange={() => toggleBranch(branch.shop_id)} className="h-5 w-5 accent-indigo-600" />
                  <span className="break-words">{branch.shop_name}</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <input type="radio" name="default-shop" checked={defaultShopId === branch.shop_id} disabled={!assigned} onChange={() => setDefaultShopId(branch.shop_id)} className="h-4 w-4 accent-indigo-600" />
                  Active branch
                </label>
              </div>
            )
          })}
        </div>
      </fieldset>
      {error ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p> : null}
    </DialogFrame>
  )
}

export function EditRoleDialog({
  staff,
  roles,
  pending,
  onClose,
  onSubmit,
}: {
  staff: StaffMember | null
  roles: AssignableStaffRole[]
  pending: boolean
  onClose: () => void
  onSubmit: (role: AssignableStaffRole) => Promise<void>
}) {
  const [role, setRole] = useState<AssignableStaffRole>('manager')

  useEffect(() => {
    if (staff && staff.role !== 'owner') setRole(staff.role)
  }, [staff])

  return (
    <DialogFrame
      open={Boolean(staff)}
      title="Change staff role"
      description={staff ? `Update permissions for ${staff.full_name}.` : ''}
      icon={<ShieldCheck size={20} />}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancel</button>
          <button type="button" onClick={() => onSubmit(role)} disabled={pending || role === staff?.role} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">
            {pending && <Loader2 size={16} className="animate-spin" />} Save role
          </button>
        </>
      }
    >
      <Field label="Role">
        <select value={role} onChange={(event) => setRole(event.target.value as AssignableStaffRole)} className={inputClass}>
          {roles.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
        </select>
      </Field>
      <p className="mt-3 text-xs leading-5 text-slate-500">Owner access cannot be assigned here. Ownership uses the dedicated transfer workflow.</p>
    </DialogFrame>
  )
}

export function StatusConfirmDialog({
  staff,
  pending,
  onClose,
  onConfirm,
}: {
  staff: StaffMember | null
  pending: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const activating = staff?.membership_status === 'inactive'
  return (
    <DialogFrame
      open={Boolean(staff)}
      title={activating ? 'Activate access' : 'Deactivate access'}
      description={activating ? 'Restore this staff member’s business access.' : 'Business access is removed immediately; the user account is not deleted.'}
      icon={<AlertTriangle size={20} />}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={pending} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50 ${activating ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
            {pending && <Loader2 size={16} className="animate-spin" />}{activating ? 'Activate access' : 'Deactivate access'}
          </button>
        </>
      }
    >
      {staff ? (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <p className="font-black text-slate-950 dark:text-white">{staff.full_name}</p>
          <p className="mt-1 break-all text-sm text-slate-500">{staff.email}</p>
          <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{ROLE_LABELS[staff.role]}</p>
        </div>
      ) : null}
    </DialogFrame>
  )
}

export function BranchAccessDialog({
  staff,
  branches,
  pendingShopId,
  onClose,
  onGrant,
  onRevoke,
}: {
  staff: StaffMember | null
  branches: BranchOption[]
  pendingShopId: number | null
  onClose: () => void
  onGrant: (shopId: number) => Promise<void>
  onRevoke: (shopId: number) => Promise<void>
}) {
  const assignedById = useMemo(
    () => new Map(staff?.branches.map((branch) => [branch.shop_id, branch]) ?? []),
    [staff],
  )
  return (
    <DialogFrame
      open={Boolean(staff)}
      title="Branch access"
      description={staff ? `Manage locations available to ${staff.full_name}.` : ''}
      icon={<MapPin size={20} />}
      onClose={onClose}
      footer={<button type="button" onClick={onClose} disabled={pendingShopId !== null} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-slate-900">Done</button>}
    >
      <div className="space-y-3">
        {branches.map((branch) => {
          const assigned = assignedById.get(branch.shop_id)
          const isCurrent = assigned?.is_current || staff?.active_shop_id === branch.shop_id
          const pending = pendingShopId === branch.shop_id
          return (
            <div key={branch.shop_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="min-w-0">
                <p className="break-words text-sm font-black text-slate-950 dark:text-white">{branch.shop_name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{isCurrent ? 'Current active branch' : assigned ? 'Assigned' : 'Not assigned'}</p>
              </div>
              {assigned ? (
                <button type="button" onClick={() => onRevoke(branch.shop_id)} disabled={pending || isCurrent} title={isCurrent ? 'The active branch cannot be revoked' : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-300 px-3 text-sm font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-800 dark:text-rose-300">
                  {pending && <Loader2 size={15} className="animate-spin" />} Revoke
                </button>
              ) : (
                <button type="button" onClick={() => onGrant(branch.shop_id)} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white disabled:opacity-50">
                  {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Grant
                </button>
              )}
            </div>
          )
        })}
      </div>
    </DialogFrame>
  )
}

export function OwnershipTransferDialog({
  open,
  currentOwnerName,
  candidates,
  pending,
  onClose,
  onTransfer,
}: {
  open: boolean
  currentOwnerName: string
  candidates: StaffMember[]
  pending: boolean
  onClose: () => void
  onTransfer: (membershipId: number) => Promise<void>
}) {
  const [targetId, setTargetId] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const target = candidates.find((candidate) => candidate.membership_id === targetId)

  useEffect(() => {
    if (!open) return
    setTargetId(candidates[0]?.membership_id ?? null)
    setConfirmed(false)
  }, [open, candidates])

  return (
    <DialogFrame
      open={open}
      title="Transfer ownership"
      description="Move primary business ownership to another active staff member."
      icon={<ShieldCheck size={20} />}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancel</button>
          <button type="button" onClick={() => targetId && onTransfer(targetId)} disabled={pending || !targetId || !confirmed} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {pending && <Loader2 size={16} className="animate-spin" />} Confirm transfer
          </button>
        </>
      }
    >
      {candidates.length ? (
        <div className="space-y-4">
          <Field label="New owner">
            <select value={targetId ?? ''} onChange={(event) => { setTargetId(Number(event.target.value)); setConfirmed(false) }} className={inputClass}>
              {candidates.map((candidate) => <option key={candidate.membership_id} value={candidate.membership_id}>{candidate.full_name} - {ROLE_LABELS[candidate.role]}</option>)}
            </select>
          </Field>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p><strong>{target?.full_name}</strong> becomes Owner.</p>
            <p className="mt-1"><strong>{currentOwnerName}</strong> becomes Admin immediately.</p>
          </div>
          <label className="flex items-start gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-rose-600" />
            <span>I understand this changes my role and transfers business ownership.</span>
          </label>
        </div>
      ) : (
        <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">No eligible active staff member currently has valid branch access.</p>
      )}
    </DialogFrame>
  )
}

