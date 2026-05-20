import type { SalesTrendPoint } from '../../features/dashboard/types'

const formatValue = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value)

export function SalesChartCard({ points }: { points: SalesTrendPoint[] }) {
  const maxValue = Math.max(...points.map((item) => item.value), 1)

  return (
    <div className="rounded-[2rem] bg-white/90 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">
            Sales Overview
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
            Sales Trends
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Daily billing performance for recent activity
          </p>
        </div>

        <button className="rounded-2xl bg-[#f4f6fb] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-600 shadow-inner transition hover:bg-indigo-50 hover:text-indigo-700">
          Last 7 Days
        </button>
      </div>

      {points.length === 0 ? (
        <div className="flex h-[280px] flex-col items-center justify-center rounded-[1.5rem] bg-[#f8f9fd] px-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
            <span className="text-xl">📊</span>
          </div>
          <p className="text-sm font-bold text-slate-700">
            No sales trend data available yet.
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Sales bars will appear here once invoices are created.
          </p>
        </div>
      ) : (
        <div className="relative h-[300px] rounded-[1.5rem] bg-gradient-to-b from-[#f8f9fd] to-white px-5 pb-5 pt-6">
          <div className="pointer-events-none absolute inset-x-5 top-6 flex h-[220px] flex-col justify-between">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-px bg-slate-200/60" />
            ))}
          </div>

          <div className="relative flex h-full items-end gap-2">
            {points.map((point, index) => {
              const height = Math.max((point.value / maxValue) * 210, 22)
              const isLast = index === points.length - 1

              return (
                <div
                  key={`${point.label}-${index}`}
                  className="group flex flex-1 flex-col items-center justify-end gap-3"
                >
                  <div className="flex h-6 items-center justify-center opacity-0 transition group-hover:opacity-100">
                    <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
                      {formatValue(point.value)}
                    </span>
                  </div>

                  <div
                    className={`w-full max-w-[42px] rounded-t-2xl transition-all duration-300 group-hover:-translate-y-1 ${
                      isLast
                        ? 'bg-gradient-to-t from-indigo-700 to-violet-500 shadow-[0_12px_24px_rgba(79,70,229,0.28)]'
                        : 'bg-gradient-to-t from-indigo-200 to-indigo-100 group-hover:from-indigo-400 group-hover:to-violet-300'
                    }`}
                    style={{ height: `${height}px` }}
                    title={`${point.label}: ${point.value}`}
                  />

                  <span
                    className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
                      isLast ? 'text-indigo-700' : 'text-slate-500'
                    }`}
                  >
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