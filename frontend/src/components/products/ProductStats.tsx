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
      valueClass: 'text-slate-900',
      iconWrapClass: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100',
      glowClass: 'from-indigo-500/10 to-transparent',
      borderClass: 'border-slate-200',
    },
    {
      title: 'OUT OF STOCK',
      value: stats.out_of_stock,
      subtitle:
        stats.out_of_stock > 0 ? 'Immediate action required' : 'Everything looks healthy',
      icon: <PackageX size={18} />,
      valueClass: stats.out_of_stock > 0 ? 'text-red-600' : 'text-slate-900',
      iconWrapClass: 'bg-red-50 text-red-500 ring-1 ring-red-100',
      glowClass: 'from-red-500/10 to-transparent',
      borderClass: stats.out_of_stock > 0 ? 'border-red-200' : 'border-slate-200',
    },
    {
      title: 'INVENTORY VALUE',
      value: formatCurrency(stats.inventory_value),
      subtitle: 'Estimated retail value',
      icon: <IndianRupee size={18} />,
      valueClass: 'text-slate-900',
      iconWrapClass: 'bg-violet-50 text-violet-600 ring-1 ring-violet-100',
      glowClass: 'from-violet-500/10 to-transparent',
      borderClass: 'border-slate-200',
    },
    {
      title: 'LOW STOCK ALERTS',
      value: stats.low_stock_count,
      subtitle:
        stats.low_stock_count > 0 ? 'Reorder threshold met' : 'Stock levels are stable',
      icon: <AlertTriangle size={18} />,
      valueClass: stats.low_stock_count > 0 ? 'text-orange-600' : 'text-slate-900',
      iconWrapClass: 'bg-orange-50 text-orange-500 ring-1 ring-orange-100',
      glowClass: 'from-orange-500/10 to-transparent',
      borderClass:
        stats.low_stock_count > 0 ? 'border-orange-200' : 'border-slate-200',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`group relative overflow-hidden rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,0.1)] ${card.borderClass}`}
        >
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.glowClass} opacity-100`}
          />
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-100/40 blur-2xl" />

          <div className="relative flex items-start justify-between">
            <div className="text-[12px] font-semibold tracking-[0.24em] text-slate-500">
              {card.title}
            </div>

            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${card.iconWrapClass}`}
            >
              {card.icon}
            </div>
          </div>

          <div className="relative mt-6">
            <div className={`text-5xl font-bold tracking-[-0.03em] ${card.valueClass}`}>
              {card.value}
            </div>
          </div>

          <div className="relative mt-5 flex items-center justify-between">
            <p className="text-base text-slate-500">{card.subtitle}</p>

            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-100">
              Live
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}