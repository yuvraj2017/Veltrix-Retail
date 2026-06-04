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

// ── Dark mode hook ──────────────────────────────────────────────
function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // On first load: check localStorage, then system preference
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark(prev => !prev) }
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
      <section className=" dark:bg-slate-900">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-col gap-4 mt-2 lg:mb-8 lg:flex-row lg:items-start lg:justify-between ">
          <div className="min-w-0 lg:overflow-hidden ">
            <h1 className="text-3xl font-bold tracking-[-0.02em] text-slate-900 dark:text-slate-100">
              Dashboard
            </h1>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400 lg:mt-2 lg:whitespace-nowrap">
              Welcome back, {dashboard.greeting_name}.{' '}
              <span className="hidden lg:inline">{dashboard.performance_label}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button className="rounded-xl bg-[#f0f2f7] dark:bg-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-[#e8ecf4] dark:hover:bg-slate-600">
              Export Report
            </button>

        
      

            <button className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 dark:hover:bg-indigo-500">
              Generate Bill
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading ? (
          <div className="space-y-5 lg:space-y-7">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[120px] animate-pulse rounded-2xl bg-white dark:bg-slate-800 shadow-sm lg:h-[148px]"
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-7">
              <div className="h-[280px] animate-pulse rounded-2xl bg-white dark:bg-slate-800 shadow-sm lg:h-[390px]" />
              <div className="h-[280px] animate-pulse rounded-2xl bg-white dark:bg-slate-800 shadow-sm lg:h-[390px]" />
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.7fr_0.9fr] lg:gap-7">
              <div className="h-[320px] animate-pulse rounded-2xl bg-white dark:bg-slate-800 shadow-sm lg:h-[420px]" />
              <div className="h-[320px] animate-pulse rounded-2xl bg-white dark:bg-slate-800 shadow-sm lg:h-[420px]" />
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

            <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-7 xl:grid-cols-2 lg:gap-7">
              <SalesChartCard points={dashboard.sales_trends} />
              <RevenueProfitCard points={dashboard.revenue_profit} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-7 lg:grid-cols-2 xl:grid-cols-[1.7fr_0.9fr] lg:gap-7">
              <RecentBillsTable bills={dashboard.recent_bills} />
              <LowStockList products={dashboard.low_stock_products} />
            </div>
          </>
        )}

      </section>
    </AppShell>
  )
}