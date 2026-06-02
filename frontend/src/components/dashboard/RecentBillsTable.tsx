import type { RecentBill } from '../../features/dashboard/types'

function getStatusClasses(status: RecentBill['status']) {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700'
    case 'PARTIAL':
      return 'bg-indigo-100 text-indigo-700'
    case 'OVERDUE':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-orange-100 text-orange-700'
  }
}

export function RecentBillsTable({ bills }: { bills: RecentBill[] }) {
  return (
    <div className="rounded-3xl bg-white shadow-sm w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-8 py-5 sm:py-7">
        <h3 className="text-lg sm:text-2xl font-semibold text-slate-900">Recent Bills</h3>
        <button className="text-xs sm:text-sm font-semibold text-indigo-600 whitespace-nowrap ml-4">
          View All Transactions
        </button>
      </div>

      <div className="px-4 sm:px-8 pb-6 sm:pb-8">

        {/* ── Desktop / Tablet table (sm and up) ── */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-4 px-6 py-4 text-xs font-semibold tracking-[0.16em] text-slate-500">
            <span>BILL ID</span>
            <span>DATE</span>
            <span>AMOUNT</span>
            <span>STATUS</span>
          </div>

          <div className="space-y-2">
            {bills.length === 0 ? (
              <div className="rounded-2xl bg-[#f8f9fd] px-6 py-12 text-center text-sm font-medium text-slate-500">
                No recent bills found.
              </div>
            ) : (
              bills.map((bill) => (
                <div
                  key={bill.id}
                  className="grid grid-cols-4 items-center rounded-2xl px-6 py-5 text-sm text-slate-700 hover:bg-[#f8f9fd] transition-colors"
                >
                  <span className="font-semibold text-slate-900 truncate pr-2">{bill.id}</span>
                  <span className="truncate pr-2">{bill.date}</span>
                  <span className="font-semibold text-slate-900 truncate pr-2">{bill.amount}</span>
                  <span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(bill.status)}`}
                    >
                      {bill.status}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Mobile card list (below sm) ── */}
        <div className="sm:hidden">
          {bills.length === 0 ? (
            <div className="rounded-2xl bg-[#f8f9fd] px-4 py-10 text-center text-sm font-medium text-slate-500">
              No recent bills found.
            </div>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <div
                  key={bill.id}
                  className="rounded-2xl bg-[#f8f9fd] px-4 py-4 text-sm text-slate-700"
                >
                  {/* Top row: ID + badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-slate-900 truncate mr-2">{bill.id}</span>
                    <span
                      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(bill.status)}`}
                    >
                      {bill.status}
                    </span>
                  </div>

                  {/* Bottom row: date + amount */}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{bill.date}</span>
                    <span className="font-semibold text-slate-900">{bill.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}