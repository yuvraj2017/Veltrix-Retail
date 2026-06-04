import {
  Banknote,
  BriefcaseBusiness,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type StatItem = {
  title: string
  value: string
  change: string
  positive: boolean
  highlight?: boolean
  warning_label?: string
}

type StatGridProps = {
  items: StatItem[]
}

type StatCardProps = {
  item: StatItem
  index: number
}

const icons: LucideIcon[] = [
  BriefcaseBusiness,
  CreditCard,
  Wallet,
  Banknote,
  TrendingUp,
]

const ACCENTS = ['#534AB7', '#7F77DD', '#185FA5', '#0F6E56', '#BA7517']

const ICON_STYLES = [
  { bg: '#EEEDFE', color: '#534AB7', darkBg: 'rgba(83,74,183,0.15)', darkColor: '#9d97f0' },
  { bg: '#EEEDFE', color: '#7F77DD', darkBg: 'rgba(127,119,221,0.15)', darkColor: '#b0aaee' },
  { bg: '#E6F1FB', color: '#185FA5', darkBg: 'rgba(24,95,165,0.15)', darkColor: '#6aabea' },
  { bg: '#E1F5EE', color: '#0F6E56', darkBg: 'rgba(15,110,86,0.15)', darkColor: '#4dbfa0' },
  { bg: '#FAEEDA', color: '#BA7517', darkBg: 'rgba(186,117,23,0.15)', darkColor: '#e6a94a' },
]

const WARNING_ICON_STYLE = {
  bg: '#FAEEDA', color: '#BA7517',
  darkBg: 'rgba(186,117,23,0.15)', darkColor: '#e6a94a',
}

export function StatGrid({ items }: StatGridProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
      {items.map((item, index) => (
        <StatCard key={item.title} item={item} index={index} />
      ))}
    </div>
  )
}

export function StatCard({ item, index }: StatCardProps) {
  const Icon = icons[index % icons.length] || TrendingUp
  const TrendIcon = item.positive ? TrendingUp : TrendingDown
  const isWarning = Boolean(item.highlight)

  const accent = isWarning ? '#BA7517' : ACCENTS[index % ACCENTS.length]
  const iconStyle = isWarning ? WARNING_ICON_STYLE : ICON_STYLES[index % ICON_STYLES.length]

  return (
    <div
      className={`
        group relative overflow-hidden cursor-default
        flex-[1_1_160px] min-w-0
        bg-white dark:bg-slate-800
        border border-black/[0.08] dark:border-white/[0.08]
        rounded-[14px] p-4
        transition-transform duration-200
        hover:-translate-y-0.5
      `}
    >
      {/* Hover accent bar */}
      <div
        className="accent-bar absolute bottom-0 left-0 right-0 h-[2px] scale-x-0 origin-left transition-transform duration-[350ms] ease-out group-hover:scale-x-100"
        style={{ background: accent }}
      />

      {/* Top row */}
      <div className="flex items-center justify-between mb-[14px]">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 dark:[background:var(--icon-dark-bg)] [background:var(--icon-bg)] dark:[color:var(--icon-dark-color)] [color:var(--icon-color)]"
          style={{
            '--icon-bg': iconStyle.bg,
            '--icon-color': iconStyle.color,
            '--icon-dark-bg': iconStyle.darkBg,
            '--icon-dark-color': iconStyle.darkColor,
          } as React.CSSProperties}
        >
          <Icon size={18} strokeWidth={2.2} />
        </div>

        {/* Badge */}
        {isWarning ? (
          <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-[9px] py-[3px] rounded-full whitespace-nowrap bg-[#FCEBEB] text-[#A32D2D] dark:bg-[rgba(163,45,45,0.18)] dark:text-[#f87171]">
            {item.warning_label ?? 'Warning'}
          </span>
        ) : item.positive ? (
          <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-[9px] py-[3px] rounded-full whitespace-nowrap bg-[#EAF3DE] text-[#3B6D11] dark:bg-[rgba(59,109,17,0.18)] dark:text-[#86efac]">
            Growth
          </span>
        ) : (
          <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-[9px] py-[3px] rounded-full whitespace-nowrap bg-[#FCEBEB] text-[#A32D2D] dark:bg-[rgba(163,45,45,0.18)] dark:text-[#f87171]">
            Drop
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 dark:text-slate-500 m-0">
        {item.title}
      </p>

      {/* Value */}
      <p className="text-[26px] font-extrabold tracking-[-0.02em] leading-[1.1] mt-1 mb-3 text-slate-950 dark:text-white">
        {item.value}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-[10px] px-[10px] py-[7px] gap-2">
        <div
          className={`flex items-center gap-[5px] text-[11px] font-bold ${
            isWarning
              ? 'text-[#A32D2D] dark:text-[#f87171]'
              : item.positive
                ? 'text-[#1D9E75] dark:text-[#4ade80]'
                : 'text-[#A32D2D] dark:text-[#f87171]'
          }`}
        >
          <TrendIcon size={14} strokeWidth={2.5} />
          <span>{item.change}</span>
        </div>

        <div
          className="w-2 h-2 rounded-full"
          style={{ background: accent }}
        />
      </div>
    </div>
  )
}