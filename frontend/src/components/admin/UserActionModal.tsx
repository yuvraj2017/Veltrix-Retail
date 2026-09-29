import { AlertTriangle, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AdminActionDescriptor } from './adminActions'

type UserActionModalProps = {
  descriptor: AdminActionDescriptor | null
  userName: string
  loading: boolean
  error: string
  onClose: () => void
  onConfirm: (reason?: string) => void
}

/**
 * Confirmation dialog for a single account action.
 *
 * Follows the ExpenseFormModal shell: sheet from the bottom on mobile,
 * centred card from sm up. The confirm button is disabled while the request is
 * in flight, which is what prevents an accidental double submission.
 */
export function UserActionModal({
  descriptor,
  userName,
  loading,
  error,
  onClose,
  onConfirm,
}: UserActionModalProps) {
  const [reason, setReason] = useState('')

  // Reset when a different action is opened, so a note typed for one action
  // never carries over into the next.
  useEffect(() => {
    setReason('')
  }, [descriptor?.action])

  // Escape closes, but not mid-request: cancelling the dialog while the server
  // is already acting would misrepresent what happened.
  useEffect(() => {
    if (!descriptor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [descriptor, loading, onClose])

  if (!descriptor) return null

  const iconWrapClass = descriptor.destructive
    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'

  const confirmClass = descriptor.destructive
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-6 dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-action-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] dark:bg-slate-900 dark:shadow-[0_30px_80px_rgba(0,0,0,0.65)] sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-7">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] ${iconWrapClass}`}
          >
            {descriptor.destructive ? (
              <AlertTriangle size={24} />
            ) : (
              <ShieldCheck size={24} />
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
          <h3
            id="user-action-title"
            className="mt-4 text-xl font-black tracking-[-0.02em] text-slate-950 dark:text-white"
          >
            {descriptor.title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {descriptor.description(userName)}
          </p>

          {descriptor.collectsReason && (
            <label className="mt-5 block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {descriptor.reasonLabel}
              </span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Optional. Recorded in the audit log and visible only to administrators."
                className="w-full resize-none rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900 dark:focus:ring-indigo-950"
              />
            </label>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => onConfirm(reason.trim() || undefined)}
              disabled={loading}
              className={`rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${confirmClass}`}
            >
              {loading ? 'Working...' : descriptor.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
