import type { SalesTrendPoint } from '../../features/dashboard/types'

const formatValue = (value: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)

const CHART_H = { base: 140, sm: 190, lg: 220 }

export function SalesChartCard({ points }: { points: SalesTrendPoint[] }) {
  const maxValue = Math.max(...points.map((p) => p.value), 1)

  return (
    <div className="rounded-[2rem] bg-white/90 p-4 sm:p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:bg-slate-800/90 dark:shadow-[0_18px_45px_rgba(0,0,0,0.3)]">

      {/* Header */}
      <div className="mb-5 sm:mb-7 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-400">
            Sales Overview
          </p>
          <h3 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-950 leading-tight dark:text-slate-100">
            Sales Trends
          </h3>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Daily billing performance for recent activity
          </p>
        </div>

        <button className="shrink-0 mt-1 rounded-2xl bg-[#f4f6fb] px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-slate-600 shadow-inner transition hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:hover:text-indigo-400">
          Last 7 Days
        </button>
      </div>

      {/* Empty state */}
      {points.length === 0 ? (
        <div className="flex h-[200px] sm:h-[280px] flex-col items-center justify-center rounded-[1.5rem] bg-[#f8f9fd] px-4 sm:px-6 text-center dark:bg-slate-900/50">
          <div className="mb-3 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-700">
            <span className="text-lg sm:text-xl">📊</span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
            No sales trend data available yet.
          </p>
          <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
            Sales bars will appear here once invoices are created.
          </p>
        </div>
      ) : (
        <div className="relative rounded-[1.5rem] bg-gradient-to-b from-[#f8f9fd] to-white px-3 sm:px-5 pb-3 sm:pb-5 pt-4 sm:pt-6 dark:from-slate-900/60 dark:to-slate-800/30">

          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-x-3 sm:inset-x-5 top-4 sm:top-6 flex h-[140px] sm:h-[190px] lg:h-[220px] flex-col justify-between">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-px bg-slate-200/60 dark:bg-slate-600/40" />
            ))}
          </div>

          {/* Bars row */}
          <div className="relative flex h-[180px] sm:h-[230px] lg:h-[265px] items-end gap-1 sm:gap-1.5 lg:gap-2">
            {points.map((point, index) => {
              const isLast = index === points.length - 1
              const hBase = Math.max((point.value / maxValue) * CHART_H.base, 12)
              // const hSm   = Math.max((point.value / maxValue) * CHART_H.sm,   14)
              // const hLg   = Math.max((point.value / maxValue) * CHART_H.lg,   16)

              return (
                <div
                  key={`${point.label}-${index}`}
                  className="group flex flex-1 flex-col items-center justify-end gap-1 sm:gap-2"
                >
                  {/* Tooltip */}
                  <div className="flex h-5 sm:h-6 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-slate-950 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[10px] font-bold text-white shadow-lg whitespace-nowrap dark:bg-slate-100 dark:text-slate-900">
                      {formatValue(point.value)}
                    </span>
                  </div>

                  {/* Bar */}
                  <div
                    className={[
                      'w-full rounded-t-xl sm:rounded-t-2xl transition-all duration-300 group-hover:-translate-y-1',
                      'max-w-[28px] sm:max-w-[38px] lg:max-w-[48px]',
                      isLast
                        ? 'bg-gradient-to-t from-indigo-700 to-violet-500 shadow-[0_8px_18px_rgba(79,70,229,0.28)] dark:from-indigo-500 dark:to-violet-400 dark:shadow-[0_8px_18px_rgba(99,102,241,0.35)]'
                        : 'bg-gradient-to-t from-indigo-200 to-indigo-100 group-hover:from-indigo-400 group-hover:to-violet-300 dark:from-slate-600 dark:to-slate-500 dark:group-hover:from-indigo-500 dark:group-hover:to-violet-400',
                    ].join(' ')}
                    style={{
                      height: `${hBase}px`,
                    } as React.CSSProperties}
                    title={`${point.label}: ${point.value}`}
                  />

                  {/* Label */}
                  <span className={`text-[9px] sm:text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.14em] ${
                    isLast
                      ? 'text-indigo-700 dark:text-indigo-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {point.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}