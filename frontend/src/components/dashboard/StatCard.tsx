import {
  Banknote,
  BriefcaseBusiness,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { DashboardStat } from '../../features/dashboard/types'

const icons = [BriefcaseBusiness, CreditCard, Wallet, Banknote, TrendingUp]

const ACCENTS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
]

const ICON_STYLES = [
  'bg-indigo-50 text-indigo-600',
  'bg-violet-50 text-violet-600',
  'bg-sky-50 text-sky-500',
  'bg-emerald-50 text-emerald-500',
  'bg-amber-50 text-amber-500',
]

// ─── Grid wrapper ─────────────────────────────────────────────────────────────
// Mobile  (< 640px)   → 1 column
// Tablet  (640–1023px) → 2 columns
// Laptop+ (≥ 1024px)  → 5 columns (all cards in one row, like the screenshot)
export function StatGrid({ items }: { items: DashboardStat[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
      {items.map((item, index) => (
        <StatCard key={item.title} item={item} index={index} />
      ))}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function StatCard({
  item,
  index,
}: {
  item: DashboardStat
  index: number
}) {
  const Icon = icons[index % icons.length] || TrendingUp
  const TrendIcon = item.positive ? TrendingUp : TrendingDown
  const isWarning = Boolean(item.highlight)

  const accent = isWarning ? 'bg-amber-500' : ACCENTS[index % ACCENTS.length]
  const iconStyle = isWarning
    ? 'bg-amber-50 text-amber-500'
    : ICON_STYLES[index % ICON_STYLES.length]

  return (
    <div
      className="
        group relative overflow-hidden
        rounded-2xl
        bg-white
        border border-slate-100
        shadow-[0_4px_20px_rgba(15,23,42,0.05)]
        transition-all duration-300
        hover:-translate-y-1
        hover:shadow-[0_12px_40px_rgba(15,23,42,0.10)]
        w-full min-w-0
      "
    >
      {/* Hover bottom band */}
      <div
        className={`
          absolute bottom-0 left-0 h-[3px] w-full scale-x-0 origin-left
          ${accent}
          transition-transform duration-500 ease-out
          group-hover:scale-x-100
        `}
      />

      <div className="p-4 lg:p-5">
        {/* Top row: icon + badge */}
        <div className="flex items-center justify-between gap-2">
          <div
            className={`
              flex h-9 w-9 lg:h-10 lg:w-10 shrink-0
              items-center justify-center
              rounded-xl
              ${iconStyle}
            `}
          >
            <Icon className="h-[18px] w-[18px] lg:h-5 lg:w-5" strokeWidth={2.2} />
          </div>

          <span
            className={`
              rounded-full
              px-2.5 py-1
              text-[9px] lg:text-[10px]
              font-extrabold uppercase tracking-[0.12em]
              whitespace-nowrap
              ${
                isWarning
                  ? 'bg-red-50 text-red-500'
                  : item.positive
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-500'
              }
            `}
          >
            {isWarning
              ? (item.warning_label ?? 'Warning')
              : item.positive
                ? 'Growth'
                : 'Drop'}
          </span>
        </div>

        {/* Title + Value */}
        <div className="mt-4 lg:mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 truncate">
            {item.title}
          </p>

          <p
            className={`
              mt-1.5
              text-2xl lg:text-3xl
              font-black tracking-tight leading-none truncate
              ${isWarning ? 'text-slate-900' : 'text-slate-950'}
            `}
          >
            {item.value}
          </p>
        </div>

        {/* Footer row */}
        <div
          className="
            mt-4
            flex items-center justify-between
            rounded-xl
            bg-slate-50
            px-3 py-2
            gap-2
          "
        >
          <div
            className={`
              flex items-center gap-1.5
              text-[11px] lg:text-xs font-bold min-w-0
              ${
                isWarning
                  ? 'text-red-500'
                  : item.positive
                    ? 'text-emerald-600'
                    : 'text-red-500'
              }
            `}
          >
            <TrendIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            <span className="truncate">{item.change}</span>
          </div>

          <span className={`h-2 w-2 shrink-0 rounded-full ${accent}`} />
        </div>
      </div>
    </div>
  )
} 