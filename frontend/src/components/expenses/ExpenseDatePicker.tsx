import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

type ExpenseDatePickerProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

type CalendarCell = {
  date: Date
  inCurrentMonth: boolean
}

type PanelPosition = {
  top: number
  left: number
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const PICKER_HEIGHT = 382
const PICKER_WIDTH = 320
const VIEWPORT_MARGIN = 16
const PANEL_OFFSET = 12

const pad = (value: number) => String(value).padStart(2, '0')

const parseDateValue = (value: string) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const formatDateValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const formatDisplayDate = (value: string) => {
  const parsed = parseDateValue(value)
  if (!parsed) return 'Select date'

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

const isSameDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getMonthGrid = (visibleMonth: Date) => {
  const firstDayOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const firstGridDate = new Date(firstDayOfMonth)
  firstGridDate.setDate(firstGridDate.getDate() - firstDayOfMonth.getDay())

  const cells: CalendarCell[] = []
  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(firstGridDate)
    cellDate.setDate(firstGridDate.getDate() + index)
    cells.push({
      date: cellDate,
      inCurrentMonth: cellDate.getMonth() === visibleMonth.getMonth(),
    })
  }

  return cells
}

export function ExpenseDatePicker({ value, onChange, disabled = false }: ExpenseDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => parseDateValue(value) || new Date())
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 0, left: 0 })
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

  useEffect(() => {
    const parsed = parseDateValue(value)
    if (parsed) {
      setVisibleMonth(parsed)
    }
  }, [value])

  useEffect(() => {
    if (!open) return

    const updatePanelPosition = () => {
      if (!wrapperRef.current) return

      const buttonRect = wrapperRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const preferredBelow = buttonRect.bottom + PANEL_OFFSET
      const preferredAbove = buttonRect.top - PICKER_HEIGHT - PANEL_OFFSET
      const fitsBelow = preferredBelow + PICKER_HEIGHT <= viewportHeight - VIEWPORT_MARGIN
      const fitsAbove = preferredAbove >= VIEWPORT_MARGIN

      let top = preferredBelow
      if (!fitsBelow && fitsAbove) {
        top = preferredAbove
      } else if (!fitsBelow && !fitsAbove) {
        top = clamp(
          preferredBelow,
          VIEWPORT_MARGIN,
          Math.max(VIEWPORT_MARGIN, viewportHeight - PICKER_HEIGHT - VIEWPORT_MARGIN)
        )
      }

      const left = clamp(
        buttonRect.left,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, viewportWidth - PICKER_WIDTH - VIEWPORT_MARGIN)
      )

      setPanelPosition({ top, left })
    }

    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)

    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open])

  const selectedDate = useMemo(() => parseDateValue(value), [value])
  const today = useMemo(() => new Date(), [])
  const cells = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`group flex h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left shadow-[0_12px_32px_rgba(15,23,42,0.05)] transition-all duration-200 dark:shadow-[0_16px_36px_rgba(0,0,0,0.25)] ${
          open
            ? 'border-indigo-300 bg-white ring-4 ring-indigo-100 dark:border-indigo-500 dark:bg-slate-800 dark:ring-indigo-900/40'
            : 'border-slate-200 bg-[linear-gradient(180deg,#fbfcff_0%,#edf3ff_100%)] hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-800'
        } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm dark:bg-slate-700 dark:text-slate-300 dark:shadow-none">
            <CalendarDays size={17} />
          </div>
          <span className={`truncate text-sm ${selectedDate ? 'font-medium text-slate-900 dark:text-slate-100' : 'font-normal text-slate-400 dark:text-slate-500'}`}>
            {formatDisplayDate(value)}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${open ? 'rotate-180 text-indigo-500 dark:text-indigo-400' : 'group-hover:text-slate-500 dark:group-hover:text-slate-300'}`}
        />
      </button>

      {open && (
        <div
          className="fixed z-30 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
          style={{ top: `${panelPosition.top}px`, left: `${panelPosition.left}px` }}
        >
          <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#fbfcff_0%,#f3f7ff_100%)] px-4 py-4 dark:border-slate-800 dark:bg-slate-800/90">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:shadow-none dark:hover:bg-slate-600 dark:hover:text-white"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">Expense Date</p>
                <h3 className="mt-1 text-base font-black tracking-[-0.02em] text-slate-950 dark:text-slate-100">
                  {formatMonthLabel(visibleMonth)}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:shadow-none dark:hover:bg-slate-600 dark:hover:text-white"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 dark:bg-slate-900">
            <div className="mb-3 grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex h-8 items-center justify-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell) => {
                const selected = selectedDate ? isSameDate(cell.date, selectedDate) : false
                const isToday = isSameDate(cell.date, today)

                return (
                  <button
                    key={cell.date.toISOString()}
                    type="button"
                    onClick={() => {
                      onChange(formatDateValue(cell.date))
                      setOpen(false)
                    }}
                    className={`flex h-10 items-center justify-center rounded-xl text-sm transition ${
                      selected
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 font-bold text-white shadow-[0_12px_26px_rgba(79,70,229,0.22)]'
                        : cell.inCurrentMonth
                          ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                          : 'text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800/70'
                    } ${isToday && !selected ? 'ring-1 ring-indigo-200 dark:ring-indigo-700' : ''}`}
                  >
                    {cell.date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setVisibleMonth(new Date())}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Jump to today
            </button>
            <button
              type="button"
              onClick={() => {
                const nextValue = formatDateValue(today)
                onChange(nextValue)
                setVisibleMonth(today)
                setOpen(false)
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(79,70,229,0.18)] transition hover:bg-indigo-700 dark:hover:bg-indigo-500"
            >
              Use today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}