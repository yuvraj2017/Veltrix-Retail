import { AlertTriangle, IndianRupee, Package2, PackageX } from 'lucide-react'
import type { ProductStats as ProductStatsType } from '../../features/products/types'

function formatCurrency(value: string | number) {
  const num = Number(value)
  if (Number.isNaN(num)) return `₹ ${value}`
  return `₹ ${num.toLocaleString('en-IN')}`
}

export function ProductStats({ stats }: { stats: ProductStatsType }) {
  const cards = [
    {
      title: 'TOTAL ITEMS',
      value: stats.total_items,
      subtitle: 'Products in inventory',
      icon: <Package2 size={18} />,
      valueClass: 'text-slate-900 dark:text-slate-100',
      iconWrapClass: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-100 dark:ring-indigo-900',
      glowClass: 'from-indigo-500/10 to-transparent',
      borderClass: 'border-slate-200 dark:border-slate-700',
    },
    {
      title: 'OUT OF STOCK',
      value: stats.out_of_stock,
      subtitle: stats.out_of_stock > 0 ? 'Immediate action required' : 'Everything looks healthy',
      icon: <PackageX size={18} />,
      valueClass: stats.out_of_stock > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100',
      iconWrapClass: 'bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 ring-1 ring-red-100 dark:ring-red-900',
      glowClass: 'from-red-500/10 to-transparent',
      borderClass: stats.out_of_stock > 0 ? 'border-red-200 dark:border-red-900' : 'border-slate-200 dark:border-slate-700',
    },
    {
      title: 'INVENTORY VALUE',
      value: formatCurrency(stats.inventory_value),
      subtitle: 'Estimated retail value',
      icon: <IndianRupee size={18} />,
      valueClass: 'text-slate-900 dark:text-slate-100',
      iconWrapClass: 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 ring-1 ring-violet-100 dark:ring-violet-900',
      glowClass: 'from-violet-500/10 to-transparent',
      borderClass: 'border-slate-200 dark:border-slate-700',
    },
    {
      title: 'LOW STOCK ALERTS',
      value: stats.low_stock_count,
      subtitle: stats.low_stock_count > 0 ? 'Reorder threshold met' : 'Stock levels are stable',
      icon: <AlertTriangle size={18} />,
      valueClass: stats.low_stock_count > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-slate-100',
      iconWrapClass: 'bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400 ring-1 ring-orange-100 dark:ring-orange-900',
      glowClass: 'from-orange-500/10 to-transparent',
      borderClass: stats.low_stock_count > 0 ? 'border-orange-200 dark:border-orange-900' : 'border-slate-200 dark:border-slate-700',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 xl:grid-cols-4 sm:gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`group relative overflow-hidden rounded-[22px] border bg-white dark:bg-slate-800/60 p-5 shadow-[0_6px_24px_rgba(15,23,42,0.05)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)] dark:hover:shadow-[0_14px_40px_rgba(0,0,0,0.4)] ${card.borderClass}`}
        >
          {/* Glow overlay */}
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.glowClass} opacity-100`}
          />
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-100/40 dark:bg-slate-700/40 blur-2xl" />

          {/* Header: title + icon */}
          <div className="relative flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase leading-snug flex-1">
              {card.title}
            </div>
            <div
              className={`flex-shrink-0 flex h-[38px] w-[38px] items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${card.iconWrapClass}`}
            >
              {card.icon}
            </div>
          </div>

          {/* Value */}
          <div className="relative mt-4">
            <div
              className={`text-[clamp(28px,5vw,40px)] font-bold tracking-[-0.03em] leading-none break-words ${card.valueClass}`}
            >
              {card.value}
            </div>
          </div>

          {/* Footer: subtitle + badge */}
          <div className="relative mt-4 flex items-center justify-between gap-2">
            <p className="text-[13px] leading-snug text-slate-500 dark:text-slate-400 flex-1 min-w-0">
              {card.subtitle}
            </p>
            <span className="flex-shrink-0 rounded-full bg-slate-50 dark:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 ring-1 ring-slate-100 dark:ring-slate-600 whitespace-nowrap">
              Live
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}