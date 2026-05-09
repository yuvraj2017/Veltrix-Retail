import { AppShell } from '../components/layout/AppShell'
import { LowStockList } from '../components/dashboard/LowStockList'
import { RecentBillsTable } from '../components/dashboard/RecentBillsTable'
import { RevenueProfitCard } from '../components/dashboard/RevenueProfitCard'
import { SalesChartCard } from '../components/dashboard/SalesChartCard'
import { StatCard } from '../components/dashboard/StatCard'
import { lowStockProducts, recentBills, stats } from '../features/dashboard/mock-data'

export default function DashboardPage() {
  return (
    <AppShell>
      <section>
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-5xl font-bold tracking-[-0.02em] text-slate-900">Dashboard</h1>
            <p className="mt-2 text-2xl text-slate-600">
              Welcome back, your store is performing at 112% today.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button className="rounded-2xl bg-[#f0f2f7] px-6 py-4 text-base font-semibold text-slate-700">
              Export Report
            </button>
            <button className="rounded-2xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-md hover:bg-indigo-700">
              Generate Bill
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-5">
          {stats.map((item, index) => (
            <StatCard key={item.title} item={item} index={index} />
          ))}
        </div>

        <div className="mt-7 grid grid-cols-[1fr_1fr] gap-7">
          <SalesChartCard />
          <RevenueProfitCard />
        </div>

        <div className="mt-7 grid grid-cols-[1.7fr_0.9fr] gap-7">
          <RecentBillsTable bills={recentBills} />
          <LowStockList products={lowStockProducts} />
        </div>
      </section>
    </AppShell>
  )
}