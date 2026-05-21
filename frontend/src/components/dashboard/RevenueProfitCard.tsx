import type { RevenueProfitPoint } from '../../features/dashboard/types'

const formatValue = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value)

export function RevenueProfitCard({ points }: { points: RevenueProfitPoint[] }) {
  const maxValue = Math.max(
    ...points.flatMap((item) => [item.revenue, item.profit]),
    1,
  )

  const totalRevenue = points.reduce((sum, item) => sum + item.revenue, 0)
  const totalProfit = points.reduce((sum, item) => sum + item.profit, 0)

  return (
    <div className="rounded-[2rem] bg-white/90 p-4 sm:p-5 lg:p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">

      {/* Header */}
      <div className="mb-4 sm:mb-5 lg:mb-7 flex flex-col xs:flex-row xs:items-start xs:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">
            Financial Health
          </p>
          <h3 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-950 leading-tight">
            Revenue vs Profit
          </h3>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
            Compare sales revenue with estimated profit
          </p>
        </div>

        {/* Badges — shrink-0 prevents them from wrapping awkwardly */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="rounded-xl sm:rounded-2xl bg-[#f4f6fb] px-3 sm:px-4 py-1.5 sm:py-2">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Revenue</p>
            <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900">₹{formatValue(totalRevenue)}</p>
          </div>
          <div className="rounded-xl sm:rounded-2xl bg-indigo-50 px-3 sm:px-4 py-1.5 sm:py-2">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400">Profit</p>
            <p className="mt-0.5 text-xs sm:text-sm font-bold text-indigo-700">₹{formatValue(totalProfit)}</p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {points.length === 0 ? (
        <div className="flex h-[200px] sm:h-[280px] flex-col items-center justify-center rounded-[1.5rem] bg-[#f8f9fd] px-4 sm:px-6 text-center">
          <div className="mb-3 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <span className="text-lg sm:text-xl">₹</span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-700">No revenue and profit data available yet.</p>
          <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-500">
            Revenue comparison will appear once billing data is available.
          </p>
        </div>
      ) : (
        <div className="rounded-[1.5rem] bg-gradient-to-b from-[#f8f9fd] to-white px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5 pt-4 sm:pt-5 lg:pt-6 overflow-hidden">

          {/* Legend */}
          <div className="mb-3 sm:mb-4 lg:mb-5 flex items-center justify-end gap-3 sm:gap-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-indigo-700 shadow-[0_0_0_3px_rgba(79,70,229,0.12)]" />
              Revenue
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-violet-300 shadow-[0_0_0_3px_rgba(196,181,253,0.2)]" />
              Profit
            </div>
          </div>

          {/* Chart container — fixed height so % bar heights work correctly */}
          <div className="relative h-[190px] sm:h-[220px] lg:h-[250px]">

            {/* Grid lines — positioned behind bars */}
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-px bg-slate-200/60" />
              ))}
            </div>

            {/* Columns grid */}
            <div
              className="absolute inset-0 pb-7"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
                gap: '4px',
              }}
            >
              {points.map((point) => {
                // Use percentage of maxValue so bars scale with any container height
                const revenueHeightPct = Math.max((point.revenue / maxValue) * 100, 5)
                const profitHeightPct  = Math.max((point.profit  / maxValue) * 100, 4)

                return (
                  <div
                    key={point.label}
                    className="group flex flex-col items-center justify-end h-full"
                  >
                    {/* Tooltip */}
                    <div className="flex items-end justify-center opacity-0 transition-opacity group-hover:opacity-100 w-full mb-1">
                      <span className="rounded-full bg-slate-950 px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[7px] sm:text-[9px] lg:text-[10px] font-bold text-white shadow-lg whitespace-nowrap">
                        ₹{formatValue(point.revenue)}/₹{formatValue(point.profit)}
                      </span>
                    </div>

                    {/* Bar pair — fills remaining height, bars align to bottom */}
                    <div className="flex w-full items-end justify-center gap-[2px] sm:gap-1 lg:gap-1.5 flex-1">
                      {/* Revenue bar */}
                      <div
                        className="rounded-t-lg sm:rounded-t-xl lg:rounded-t-2xl bg-gradient-to-t from-indigo-700 to-violet-500 shadow-[0_6px_14px_rgba(79,70,229,0.22)] transition-all duration-300 group-hover:-translate-y-1 self-end"
                        style={{
                          height: `${revenueHeightPct}%`,
                          width: 'clamp(10px, 42%, 36px)',
                          minHeight: '6px',
                        }}
                        title={`Revenue: ₹${formatValue(point.revenue)}`}
                      />
                      {/* Profit bar */}
                      <div
                        className="rounded-t-lg sm:rounded-t-xl lg:rounded-t-2xl bg-gradient-to-t from-indigo-200 to-violet-200 transition-all duration-300 group-hover:-translate-y-1 group-hover:from-indigo-300 group-hover:to-violet-300 self-end"
                        style={{
                          height: `${profitHeightPct}%`,
                          width: 'clamp(10px, 42%, 36px)',
                          minHeight: '4px',
                        }}
                        title={`Profit: ₹${formatValue(point.profit)}`}
                      />
                    </div>

                    {/* Label */}
                    <span className="text-[9px] sm:text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.1em] lg:tracking-[0.14em] text-slate-500 mt-1 shrink-0">
                      {point.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}