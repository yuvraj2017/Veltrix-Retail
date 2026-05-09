import type { RecentBill } from '../../features/dashboard/types'

export function RecentBillsTable({ bills }: { bills: RecentBill[] }) {
  return (
    <div className="rounded-3xl bg-white shadow-sm">
      <div className="flex items-center justify-between px-8 py-7">
        <h3 className="text-2xl font-semibold text-slate-900">Recent Bills</h3>
        <button className="text-sm font-semibold text-indigo-600">View All Transactions</button>
      </div>

      <div className="px-8 pb-8">
        <div className="grid grid-cols-4 px-6 py-4 text-xs font-semibold tracking-[0.16em] text-slate-500">
          <span>BILL ID</span>
          <span>DATE</span>
          <span>AMOUNT</span>
          <span>STATUS</span>
        </div>

        <div className="space-y-2">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="grid grid-cols-4 items-center rounded-2xl px-6 py-5 text-sm text-slate-700 hover:bg-[#f8f9fd]"
            >
              <span className="font-semibold text-slate-900">{bill.id}</span>
              <span>{bill.date}</span>
              <span className="font-semibold text-slate-900">{bill.amount}</span>
              <span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    bill.status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {bill.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}