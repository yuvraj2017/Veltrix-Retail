export function RevenueProfitCard() {
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

      <div className="flex h-[280px] items-end justify-between rounded-2xl">
        {['Q1', 'Q2', 'Q3', 'Q4', 'YTD'].map((label) => (
          <div key={label} className="flex flex-col items-center gap-3 text-xs font-semibold tracking-[0.16em] text-slate-600">
            <div className="h-[220px] w-10 rounded-full bg-[#f3f5f9]" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}