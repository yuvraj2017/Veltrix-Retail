import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useBranch } from '../../context/BranchContext'

export function BranchSelector() {
  const location = useLocation()
  const {
    branches,
    selectedBranch,
    switchBranch,
    isSwitching,
    switchBlocked,
  } = useBranch()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const posLocked = location.pathname.startsWith('/billing/new')
  const disabled = isSwitching || switchBlocked || posLocked

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  if (!selectedBranch) return null

  if (branches.length === 1) {
    return (
      <div
        data-testid="current-branch"
        className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
        title={selectedBranch.name}
      >
        <Building2 size={17} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
        <span className="truncate text-sm font-bold">{selectedBranch.name}</span>
      </div>
    )
  }

  const selectBranch = async (branchId: number) => {
    setError('')
    try {
      await switchBranch(branchId)
      setOpen(false)
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : 'Unable to switch branches.')
    }
  }

  const lockedReason = posLocked
    ? 'Finish or leave the current sale before switching branches.'
    : switchBlocked
      ? 'Wait for the current operation to finish.'
      : undefined

  return (
    <div ref={rootRef} className="relative min-w-0" data-testid="branch-selector">
      <button
        type="button"
        data-testid="branch-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        title={lockedReason || selectedBranch.name}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white/85 px-3 text-left text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/85 dark:text-slate-200 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
      >
        {isSwitching ? (
          <Loader2 size={17} className="shrink-0 animate-spin text-indigo-600" />
        ) : (
          <Building2 size={17} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{selectedBranch.name}</span>
          <span className="block truncate text-[10px] font-semibold uppercase text-slate-400">
            Current branch
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select branch"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(22rem,70vh)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="px-2 pb-2 pt-1 text-[10px] font-black uppercase text-slate-400">Switch branch</p>
          {branches.map((branch) => {
            const selected = branch.id === selectedBranch.id
            return (
              <button
                key={branch.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => void selectBranch(branch.id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition ${
                  selected
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Building2 size={17} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-bold">{branch.name}</span>
                  {(branch.is_default_branch || branch.is_preferred) && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {branch.is_default_branch ? 'Default' : 'Preferred'}
                    </span>
                  )}
                </span>
                {selected && <Check size={17} className="shrink-0" />}
              </button>
            )
          })}
          {error && <p role="alert" className="px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
