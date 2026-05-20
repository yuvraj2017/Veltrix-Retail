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
  'bg-sky-600',
  'bg-emerald-600',
  'bg-amber-500',
]

export function StatCard({
  item,
  index,
}: {
  item: DashboardStat
  index: number
}) {
  const Icon = icons[index] || TrendingUp
  const TrendIcon = item.positive ? TrendingUp : TrendingDown
  const isWarning = Boolean(item.highlight)

  const accent = isWarning ? 'bg-red-500' : ACCENTS[index % ACCENTS.length]

  return (
    <div className="group relative overflow-hidden rounded-[2rem] bg-white shadow-[0_16px_42px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.09)]">
      {/* Bottom hover band */}
      <div
        className={`absolute bottom-0 left-1/2 h-2 w-full -translate-x-1/2 scale-x-0 ${accent} transition-transform duration-500 ease-out group-hover:scale-x-100`}
      />

      <div className="p-6 pb-7">
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              isWarning
                ? 'bg-red-50 text-red-600'
                : 'bg-indigo-50 text-indigo-700'
            }`}
          >
            <Icon size={22} strokeWidth={2.4} />
          </div>

          <span
            className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
              isWarning
                ? 'bg-red-50 text-red-600'
                : item.positive
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-500'
            }`}
          >
            {isWarning
              ? item.warning_label || 'Warning'
              : item.positive
                ? 'Growth'
                : 'Drop'}
          </span>
        </div>

        <div className="mt-7">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            {item.title}
          </p>

          <p
            className={`mt-3 text-3xl font-black tracking-tight sm:text-[2.35rem] ${
              isWarning ? 'text-red-600' : 'text-slate-950'
            }`}
          >
            {item.value}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl bg-[#f8f9fd] px-4 py-3">
          <div
            className={`flex items-center gap-2 text-sm font-bold ${
              isWarning
                ? 'text-red-600'
                : item.positive
                  ? 'text-emerald-600'
                  : 'text-red-500'
            }`}
          >
            <TrendIcon size={16} strokeWidth={2.5} />
            <span>{item.change}</span>
          </div>

          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        </div>
      </div>
    </div>
  )
}