import type { RevenueProfitPoint } from '../../features/dashboard/types'

const formatValue = (value: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)

export function RevenueProfitCard({ points }: { points: RevenueProfitPoint[] }) {
  const maxValue = Math.max(
    ...points.flatMap((p) => [p.revenue, p.profit]),
    1,
  )
  const totalRevenue = points.reduce((s, p) => s + p.revenue, 0)
  const totalProfit  = points.reduce((s, p) => s + p.profit,  0)

  return (
    <div className="rounded-[2rem] bg-white/90 p-4 sm:p-5 lg:p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">

      {/* Header — always row, badges always right */}
      <div className="mb-4 sm:mb-5 lg:mb-7 flex flex-row items-start justify-between gap-2">
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

        {/* Badges */}
        <div className="flex items-start gap-1.5 sm:gap-3 shrink-0 mt-1">
          <div className="rounded-xl sm:rounded-2xl bg-[#f4f6fb] px-2 sm:px-4 py-1.5 sm:py-2">
            <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Revenue
            </p>
            <p className="mt-0.5 text-[11px] sm:text-sm font-bold text-slate-900">
              ₹{formatValue(totalRevenue)}
            </p>
          </div>
          <div className="rounded-xl sm:rounded-2xl bg-indigo-50 px-2 sm:px-4 py-1.5 sm:py-2">
            <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400">
              Profit
            </p>
            <p className="mt-0.5 text-[11px] sm:text-sm font-bold text-indigo-700">
              ₹{formatValue(totalProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {points.length === 0 ? (
        <div className="flex h-[200px] sm:h-[280px] flex-col items-center justify-center rounded-[1.5rem] bg-[#f8f9fd] px-4 sm:px-6 text-center">
          <div className="mb-3 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <span className="text-lg sm:text-xl">₹</span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-700">
            No revenue and profit data available yet.
          </p>
          <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-500">
            Revenue comparison will appear once billing data is available.
          </p>
        </div>
      ) : (
        <div className="rounded-[1.5rem] bg-gradient-to-b from-[#f8f9fd] to-white px-3 sm:px-4 lg:px-5 pb-3 sm:pb-4 lg:pb-5 pt-4 sm:pt-5 lg:pt-6 overflow-hidden">

          {/* Legend */}
          <div className="mb-3 sm:mb-4 lg:mb-5 flex items-center justify-end gap-3 sm:gap-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-indigo-700 shadow-[0_0_0_3px_rgba(79,70,229,0.12)]" />
              Revenue
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-violet-300 shadow-[0_0_0_3px_rgba(196,181,253,0.2)]" />
              Profit
            </div>
          </div>

          {/* Chart */}
          <div className="relative h-[180px] sm:h-[220px] lg:h-[250px]">

            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-px bg-slate-200/60" />
              ))}
            </div>

            {/* Columns */}
            <div
              className="absolute inset-0 pb-7"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
                gap: '2px',
              }}
            >
              {points.map((point) => {
                const revPct    = Math.max((point.revenue / maxValue) * 100, 5)
                const profitPct = Math.max((point.profit  / maxValue) * 100, 4)

                return (
                  <div
                    key={point.label}
                    className="group flex flex-col items-center justify-end h-full"
                  >
                    {/* Tooltip */}
                    <div className="flex flex-col items-center opacity-0 transition-opacity group-hover:opacity-100 w-full mb-1 gap-px">
                      <span className="rounded-full bg-slate-950 px-1.5 sm:px-2 py-0.5 text-[7px] sm:text-[9px] font-bold text-white shadow-lg whitespace-nowrap">
                        ₹{formatValue(point.revenue)}
                      </span>
                      <span className="rounded-full bg-indigo-600 px-1.5 sm:px-2 py-0.5 text-[7px] sm:text-[9px] font-bold text-white shadow-lg whitespace-nowrap">
                        ₹{formatValue(point.profit)}
                      </span>
                    </div>

                    {/* Bar pair */}
                    <div className="flex w-full items-end justify-center gap-px sm:gap-0.5 lg:gap-1 flex-1">
                      {/* Revenue */}
                      <div
                        className="rounded-t-lg sm:rounded-t-xl bg-gradient-to-t from-indigo-700 to-violet-500 shadow-[0_6px_14px_rgba(79,70,229,0.22)] transition-all duration-300 group-hover:-translate-y-1 self-end w-[38%] sm:w-[40%] max-w-[14px] sm:max-w-[22px] lg:max-w-[32px]"
                        style={{ height: `${revPct}%`, minHeight: '6px' }}
                        title={`Revenue: ₹${formatValue(point.revenue)}`}
                      />
                      {/* Profit */}
                      <div
                        className="rounded-t-lg sm:rounded-t-xl bg-gradient-to-t from-indigo-200 to-violet-200 transition-all duration-300 group-hover:-translate-y-1 group-hover:from-indigo-300 group-hover:to-violet-300 self-end w-[38%] sm:w-[40%] max-w-[14px] sm:max-w-[22px] lg:max-w-[32px]"
                        style={{ height: `${profitPct}%`, minHeight: '4px' }}
                        title={`Profit: ₹${formatValue(point.profit)}`}
                      />
                    </div>

                    {/* Label */}
                    <span className="text-[8px] sm:text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.1em] lg:tracking-[0.14em] text-slate-500 mt-1 shrink-0">
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