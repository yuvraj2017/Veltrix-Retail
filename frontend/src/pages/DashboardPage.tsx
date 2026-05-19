import { useEffect, useState } from 'react'
import { AppShell } from '../components/layout/AppShell'
import { LowStockList } from '../components/dashboard/LowStockList'
import { RecentBillsTable } from '../components/dashboard/RecentBillsTable'
import { RevenueProfitCard } from '../components/dashboard/RevenueProfitCard'
import { SalesChartCard } from '../components/dashboard/SalesChartCard'
import { StatCard } from '../components/dashboard/StatCard'
import { getDashboardOverview } from '../features/dashboard/api'
import type { DashboardOverview } from '../features/dashboard/types'

const emptyDashboard: DashboardOverview = {
  greeting_name: 'Merchant',
  performance_label: 'Your store insights will appear here as soon as data is available.',
  stats: [],
  sales_trends: [],
  revenue_profit: [],
  recent_bills: [],
  low_stock_products: [],
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardOverview>(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await getDashboardOverview()
        setDashboard(data)
      } catch (err: any) {
        console.error('Failed to load dashboard overview', err)
        setError(err?.response?.data?.detail || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  return (
    <AppShell>
      <section>
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-5xl font-bold tracking-[-0.02em] text-slate-900">
              Dashboard
            </h1>
            <p className="mt-2 text-2xl text-slate-600">
              Welcome back, {dashboard.greeting_name}. {dashboard.performance_label}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button className="rounded-2xl bg-[#f0f2f7] px-6 py-4 text-base font-semibold text-slate-700 transition hover:bg-[#e8ecf4]">
              Export Report
            </button>
            <button className="rounded-2xl bg-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700">
              Generate Bill
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-7">
            <div className="grid grid-cols-5 gap-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[148px] animate-pulse rounded-3xl bg-white shadow-sm"
                />
              ))}
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-7">
              <div className="h-[390px] animate-pulse rounded-3xl bg-white shadow-sm" />
              <div className="h-[390px] animate-pulse rounded-3xl bg-white shadow-sm" />
            </div>

            <div className="grid grid-cols-[1.7fr_0.9fr] gap-7">
              <div className="h-[420px] animate-pulse rounded-3xl bg-white shadow-sm" />
              <div className="h-[420px] animate-pulse rounded-3xl bg-white shadow-sm" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-5">
              {dashboard.stats.map((item, index) => (
                <StatCard key={`${item.title}-${index}`} item={item} index={index} />
              ))}
            </div>

            <div className="mt-7 grid grid-cols-[1fr_1fr] gap-7">
              <SalesChartCard points={dashboard.sales_trends} />
              <RevenueProfitCard points={dashboard.revenue_profit} />
            </div>

            <div className="mt-7 grid grid-cols-[1.7fr_0.9fr] gap-7">
              <RecentBillsTable bills={dashboard.recent_bills} />
              <LowStockList products={dashboard.low_stock_products} />
            </div>
          </>
        )}
      </section>
    </AppShell>
  )
}