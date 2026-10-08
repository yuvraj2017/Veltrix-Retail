import { AlertTriangle, FileCheck2, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { BranchDirtyGuardState } from '../../lib/branch-guards'

export function BranchSwitchDialog({
  branchName,
  guards,
  error,
  pending,
  onStay,
  onDiscard,
  onSave,
}: {
  branchName: string
  guards: BranchDirtyGuardState[]
  error?: string
  pending: boolean
  onStay: () => void
  onDiscard: () => Promise<void>
  onSave: () => Promise<void>
}) {
  const stayRef = useRef<HTMLButtonElement>(null)
  const canSaveAll = guards.length > 0 && guards.every((guard) => Boolean(guard.saveDraft))

  useEffect(() => {
    stayRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onStay()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onStay, pending])

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-switch-title"
        aria-describedby="branch-switch-description"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[88vh] sm:rounded-lg"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="branch-switch-title" className="text-lg font-black text-slate-950 dark:text-white">
              Switch to {branchName}?
            </h2>
            <p id="branch-switch-description" className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
              Unsaved work belongs to the current branch. Choose how to handle it before switching.
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          ) : null}
          <ul className="space-y-2">
            {guards.map((guard) => (
              <li key={guard.label} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900 dark:bg-amber-950/40">
                <p className="text-sm font-black text-slate-900 dark:text-white">{guard.label}</p>
                <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {guard.message || 'This screen contains unsaved changes.'}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={stayRef}
            type="button"
            disabled={pending}
            onClick={onStay}
            className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-black text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
          >
            Stay
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onDiscard()}
            className="min-h-11 rounded-lg bg-rose-600 px-4 text-sm font-black text-white disabled:opacity-60"
          >
            {pending ? <Loader2 size={17} className="mx-auto animate-spin" /> : 'Discard and switch'}
          </button>
          {canSaveAll ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void onSave()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-black text-white disabled:opacity-60"
            >
              <FileCheck2 size={17} />
              Save draft and switch
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
