import { Banknote, BriefcaseBusiness, CreditCard, TrendingUp, Wallet } from 'lucide-react'
import type { DashboardStat } from '../../features/dashboard/types'

const icons = [BriefcaseBusiness, CreditCard, Wallet, Banknote, TrendingUp]

export function StatCard({
  item,
  index,
}: {
  item: DashboardStat
  index: number
}) {
  const Icon = icons[index] || TrendingUp

  if (item.highlight) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-red-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-700">
              {item.title}
            </p>
            <p className="mt-5 text-4xl font-bold text-red-600">{item.value}</p>
            <p className="mt-2 text-sm text-slate-500">{item.change}</p>
          </div>

          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
            {item.warning_label || 'WARNING'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-700">
          {item.title}
        </p>
        <Icon size={20} className="text-indigo-600" />
      </div>

      <div className="mt-7">
        <p className="text-4xl font-bold text-slate-900">{item.value}</p>
        <p
          className={`mt-2 text-sm font-medium ${
            item.positive ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          {item.change}
        </p>
      </div>
    </div>
  )
}