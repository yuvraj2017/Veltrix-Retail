const bars = [40, 58, 45, 74, 64, 88, 84]
const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export function SalesChartCard() {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-center justify-between">
        <h3 className="text-2xl font-semibold text-slate-900">Sales Trends</h3>
        <button className="rounded-2xl bg-[#f3f5f9] px-4 py-2 text-sm font-medium text-slate-600">
          Last 7 Days
        </button>
      </div>

      <div className="flex h-[280px] items-end gap-1 rounded-2xl bg-white">
        {bars.map((height, index) => (
          <div key={labels[index]} className="flex flex-1 flex-col items-center justify-end gap-4">
            <div
              className={`w-full rounded-t-md ${
                index === bars.length - 1 ? 'bg-indigo-700' : 'bg-indigo-200'
              }`}
              style={{ height: `${height * 2.2}px` }}
            />
            <span className="text-xs font-semibold tracking-[0.16em] text-slate-600">
              {labels[index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}