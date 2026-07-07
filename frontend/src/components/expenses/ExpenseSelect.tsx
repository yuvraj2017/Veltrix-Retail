import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type ExpenseSelectOption = {
  label: string
  value: string
}

type ExpenseSelectProps = {
  value: string
  onChange: (value: string) => void
  options: ExpenseSelectOption[]
  placeholder?: string
  disabled?: boolean
  compact?: boolean
}

export function ExpenseSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  compact = false,
}: ExpenseSelectProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`group flex w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left shadow-[0_12px_32px_rgba(15,23,42,0.05)] transition-all duration-200 dark:shadow-[0_16px_36px_rgba(0,0,0,0.25)] ${
          compact ? 'h-13 py-3' : 'h-14 py-3.5'
        } ${
          open
            ? 'border-indigo-300 bg-white ring-4 ring-indigo-100 dark:border-indigo-500 dark:bg-slate-800 dark:ring-indigo-900/40'
            : 'border-slate-200 bg-[linear-gradient(180deg,#fbfcff_0%,#edf3ff_100%)] hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-800'
        } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        <span className={`truncate text-sm ${selectedOption ? 'font-medium text-slate-900 dark:text-slate-100' : 'font-normal text-slate-400 dark:text-slate-500'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${open ? 'rotate-180 text-indigo-500 dark:text-indigo-400' : 'group-hover:text-slate-500 dark:group-hover:text-slate-300'}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.65rem)] z-30 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_26px_70px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_26px_70px_rgba(0,0,0,0.45)]">
          <div className="max-h-72 overflow-y-auto p-2">
            {options.map((option) => {
              const active = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-[1rem] px-4 py-3 text-left text-sm transition ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-[0_12px_26px_rgba(79,70,229,0.22)]'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{option.label}</span>
                  {active && <Check size={16} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}