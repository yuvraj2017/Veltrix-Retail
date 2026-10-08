import { useQuery } from '@tanstack/react-query'
import { LowStockList } from '../components/dashboard/LowStockList'
import { RecentBillsTable } from '../components/dashboard/RecentBillsTable'
import { RevenueProfitCard } from '../components/dashboard/RevenueProfitCard'
import { SalesChartCard } from '../components/dashboard/SalesChartCard'
import { StatCard } from '../components/dashboard/StatCard'
import { getDashboardOverview } from '../features/dashboard/api'
import type { DashboardOverview } from '../features/dashboard/types'
import { getApiErrorMessage } from '../lib/api-error'
import { useBranch } from '../context/BranchContext'
import { branchQueryKey } from '../lib/branch-query-keys'

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
  const { selectedBranchId } = useBranch()
  // Replaces the bespoke TTL map in lib/resourceCache. React Query gives the
  // same instant-render-from-cache behaviour plus background revalidation,
  // request dedup, and shared invalidation with the rest of the app.
  const dashboardQuery = useQuery({
    queryKey: branchQueryKey(selectedBranchId, 'dashboard', 'overview'),
    queryFn: getDashboardOverview,
    staleTime: 2 * 60 * 1000, // matches the previous 2 minute TTL
  })

  const dashboard: DashboardOverview = dashboardQuery.data ?? emptyDashboard
  const loading = dashboardQuery.isPending
  const error = dashboardQuery.error
    ? getApiErrorMessage(dashboardQuery.error, 'Failed to load dashboard data')
    : ''

  return (
    <section className="dark:bg-slate-900">
      <div className="mb-6 mt-2 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 lg:overflow-hidden">
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 dark:text-slate-100">
            Dashboard
          </h1>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-400 lg:mt-2 lg:whitespace-nowrap">
            Welcome back, {dashboard.greeting_name}.{' '}
            <span className="hidden lg:inline">{dashboard.performance_label}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button className="rounded-xl bg-[#f0f2f7] px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#e8ecf4] dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
            Export Report
          </button>

          <button className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 dark:hover:bg-indigo-500">
            Generate Bill
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-5 lg:space-y-7">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[120px] animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-800 lg:h-[148px]"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-7">
            <div className="h-[280px] animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-800 lg:h-[390px]" />
            <div className="h-[280px] animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-800 lg:h-[390px]" />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.7fr_0.9fr] lg:gap-7">
            <div className="h-[320px] animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-800 lg:h-[420px]" />
            <div className="h-[320px] animate-pulse rounded-2xl bg-white shadow-sm dark:bg-slate-800 lg:h-[420px]" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-5">
            {dashboard.stats.map((item, index) => {
              const statItem = { ...item, positive: item.positive ?? false }
              return <StatCard key={`${item.title}-${index}`} item={statItem} index={index} />
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-7 lg:gap-7 xl:grid-cols-2">
            <SalesChartCard points={dashboard.sales_trends} />
            <RevenueProfitCard points={dashboard.revenue_profit} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-7 lg:grid-cols-2 lg:gap-7 xl:grid-cols-[1.7fr_0.9fr]">
            <RecentBillsTable bills={dashboard.recent_bills} />
            <LowStockList products={dashboard.low_stock_products} />
          </div>
        </>
      )}
    </section>
  )
}
