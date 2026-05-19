import type { SalesTrendPoint } from '../../features/dashboard/types'

export function SalesChartCard({ points }: { points: SalesTrendPoint[] }) {
  const maxValue = Math.max(...points.map((item) => item.value), 1)

  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-slate-900">Sales Trends</h3>
        <button className="rounded-2xl bg-[#f3f5f9] px-4 py-2 text-sm font-medium text-slate-600">
          Last 7 Days
        </button>
      </div>

      {points.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center rounded-2xl bg-[#f8f9fd] text-sm font-medium text-slate-500">
          No sales trend data available yet.
        </div>
      ) : (
        <div className="flex h-[280px] items-end gap-1 rounded-2xl bg-white">
          {points.map((point, index) => {
            const height = Math.max((point.value / maxValue) * 200, 18)

            return (
              <div
                key={`${point.label}-${index}`}
                className="flex flex-1 flex-col items-center justify-end gap-4"
              >
                <div
                  className={`w-full rounded-t-md ${
                    index === points.length - 1 ? 'bg-indigo-700' : 'bg-indigo-200'
                  }`}
                  style={{ height: `${height}px` }}
                  title={`${point.label}: ${point.value}`}
                />
                <span className="text-xs font-semibold tracking-[0.16em] text-slate-600">
                  {point.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}