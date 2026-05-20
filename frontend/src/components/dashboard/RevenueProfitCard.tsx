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
    <div className="rounded-[2rem] bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">
            Financial Health
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
            Revenue vs Profit
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Compare sales revenue with estimated profit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl bg-[#f4f6fb] px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Revenue
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              ₹{formatValue(totalRevenue)}
            </p>
          </div>

          <div className="rounded-2xl bg-indigo-50 px-4 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-400">
              Profit
            </p>
            <p className="mt-0.5 text-sm font-bold text-indigo-700">
              ₹{formatValue(totalProfit)}
            </p>
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="flex h-[280px] flex-col items-center justify-center rounded-[1.5rem] bg-[#f8f9fd] px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <span className="text-xl">₹</span>
          </div>
          <p className="text-sm font-bold text-slate-700">
            No revenue and profit data available yet.
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Revenue comparison will appear once billing data is available.
          </p>
        </div>
      ) : (
        <div className="rounded-[1.5rem] bg-gradient-to-b from-[#f8f9fd] to-white px-5 pb-5 pt-6">
          <div className="mb-5 flex items-center justify-end gap-5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-700 shadow-[0_0_0_4px_rgba(79,70,229,0.12)]" />
              Revenue
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_0_4px_rgba(196,181,253,0.22)]" />
              Profit
            </div>
          </div>

          <div className="relative h-[250px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[210px] flex-col justify-between">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-px bg-slate-200/60" />
              ))}
            </div>

            <div className="relative flex h-full items-end justify-between gap-4">
              {points.map((point) => {
                const revenueHeight = Math.max((point.revenue / maxValue) * 205, 18)
                const profitHeight = Math.max((point.profit / maxValue) * 205, 14)

                return (
                  <div
                    key={point.label}
                    className="group flex flex-1 flex-col items-center gap-3"
                  >
                    <div className="flex h-6 items-center justify-center opacity-0 transition group-hover:opacity-100">
                      <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
                        ₹{formatValue(point.revenue)} / ₹{formatValue(point.profit)}
                      </span>
                    </div>

                    <div className="flex h-[205px] items-end gap-2">
                      <div
                        className="w-6 rounded-t-2xl bg-gradient-to-t from-indigo-700 to-violet-500 shadow-[0_12px_24px_rgba(79,70,229,0.22)] transition-all duration-300 group-hover:-translate-y-1 sm:w-8 lg:w-9"
                        style={{ height: `${revenueHeight}px` }}
                        title={`Revenue: ${point.revenue}`}
                      />
                      <div
                        className="w-6 rounded-t-2xl bg-gradient-to-t from-indigo-200 to-violet-200 transition-all duration-300 group-hover:-translate-y-1 group-hover:from-indigo-300 group-hover:to-violet-300 sm:w-8 lg:w-9"
                        style={{ height: `${profitHeight}px` }}
                        title={`Profit: ${point.profit}`}
                      />
                    </div>

                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
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