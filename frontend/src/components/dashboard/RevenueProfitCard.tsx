import type { RevenueProfitPoint } from '../../features/dashboard/types'

export function RevenueProfitCard({ points }: { points: RevenueProfitPoint[] }) {
  const maxValue = Math.max(
    ...points.flatMap((item) => [item.revenue, item.profit]),
    1,
  )

  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-slate-900">Revenue vs Profit</h3>

        <div className="flex items-center gap-5 text-xs font-semibold tracking-wide text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-indigo-700" />
            REVENUE
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-indigo-300" />
            PROFIT
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center rounded-2xl bg-[#f8f9fd] text-sm font-medium text-slate-500">
          No revenue and profit data available yet.
        </div>
      ) : (
        <div className="flex h-[280px] items-end justify-between gap-4 rounded-2xl">
          {points.map((point) => {
            const revenueHeight = Math.max((point.revenue / maxValue) * 220, 16)
            const profitHeight = Math.max((point.profit / maxValue) * 220, 12)

            return (
              <div
                key={point.label}
                className="flex flex-1 flex-col items-center gap-3 text-xs font-semibold tracking-[0.16em] text-slate-600"
              >
                <div className="flex h-[220px] items-end gap-2">
                  <div
                    className="w-10 rounded-full bg-indigo-700"
                    style={{ height: `${revenueHeight}px` }}
                    title={`Revenue: ${point.revenue}`}
                  />
                  <div
                    className="w-10 rounded-full bg-indigo-300"
                    style={{ height: `${profitHeight}px` }}
                    title={`Profit: ${point.profit}`}
                  />
                </div>
                <span>{point.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}