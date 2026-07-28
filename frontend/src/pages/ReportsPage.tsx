import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  RefreshCcw,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

import {
  getCashflowReport,
  getCategoryPerformanceReport,
  getCustomerInsightsReport,
  getPaymentInsightsReport,
  getReportSummary,
  getSalesProfitReport,
} from '../features/reports/api'
import type {
  CashflowReport,
  CategoryPerformanceReport,
  CustomerInsightsReport,
  PaymentInsightsReport,
  ReportPeriod,
  ReportSummary,
  SalesProfitReport,
} from '../features/reports/types'
import { loadActiveReportsPeriod, saveActiveReportsPeriod } from '../features/settings/storage'
import { getApiErrorMessage } from '../lib/api-error'

const periodOptions: { value: ReportPeriod; label: string; shortLabel: string; initial: string }[] = [
  { value: 'weekly', label: 'Weekly', shortLabel: 'Week', initial: 'W' },
  { value: 'monthly', label: 'Monthly', shortLabel: 'Month', initial: 'M' },
  { value: 'quarterly', label: 'Quarterly', shortLabel: 'Quarter', initial: 'Q' },
  { value: 'yearly', label: 'Yearly', shortLabel: 'Year', initial: 'Y' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`
}

export default function ReportsPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')

  const [salesPeriod, setSalesPeriod] = useState<ReportPeriod>(() => loadActiveReportsPeriod() as ReportPeriod)
  const [salesReport, setSalesReport] = useState<SalesProfitReport | null>(null)
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesError, setSalesError] = useState('')

  const [cashflowPeriod, setCashflowPeriod] = useState<ReportPeriod>(() => loadActiveReportsPeriod() as ReportPeriod)
  const [cashflowReport, setCashflowReport] = useState<CashflowReport | null>(null)
  const [cashflowLoading, setCashflowLoading] = useState(true)
  const [cashflowError, setCashflowError] = useState('')

  const [categoryPeriod, setCategoryPeriod] = useState<ReportPeriod>(() => loadActiveReportsPeriod() as ReportPeriod)
  const [categoryReport, setCategoryReport] = useState<CategoryPerformanceReport | null>(null)
  const [categoryLoading, setCategoryLoading] = useState(true)
  const [categoryError, setCategoryError] = useState('')

  const [customerPeriod, setCustomerPeriod] = useState<ReportPeriod>(() => loadActiveReportsPeriod() as ReportPeriod)
  const [customerReport, setCustomerReport] = useState<CustomerInsightsReport | null>(null)
  const [customerLoading, setCustomerLoading] = useState(true)
  const [customerError, setCustomerError] = useState('')

  const [paymentPeriod, setPaymentPeriod] = useState<ReportPeriod>(() => loadActiveReportsPeriod() as ReportPeriod)
  const [paymentReport, setPaymentReport] = useState<PaymentInsightsReport | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(true)
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadSummary = async () => {
      try {
        setSummaryLoading(true)
        setSummaryError('')
        const data = await getReportSummary()
        if (!cancelled) {
          setSummary(data)
        }
      } catch (error) {
        if (!cancelled) {
          setSummaryError(getApiErrorMessage(error, 'Unable to load report summary'))
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
        }
      }
    }

    loadSummary()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    let cancelled = false

    const loadSales = async () => {
      try {
        setSalesLoading(true)
        setSalesError('')
        const data = await getSalesProfitReport(salesPeriod)
        if (!cancelled) {
          setSalesReport(data)
        }
      } catch (error) {
        if (!cancelled) {
          setSalesError(getApiErrorMessage(error, 'Unable to load sales performance report'))
        }
      } finally {
        if (!cancelled) {
          setSalesLoading(false)
        }
      }
    }

    loadSales()
    return () => {
      cancelled = true
    }
  }, [salesPeriod, refreshKey])

  useEffect(() => {
    let cancelled = false

    const loadCashflow = async () => {
      try {
        setCashflowLoading(true)
        setCashflowError('')
        const data = await getCashflowReport(cashflowPeriod)
        if (!cancelled) {
          setCashflowReport(data)
        }
      } catch (error) {
        if (!cancelled) {
          setCashflowError(getApiErrorMessage(error, 'Unable to load cashflow report'))
        }
      } finally {
        if (!cancelled) {
          setCashflowLoading(false)
        }
      }
    }

    loadCashflow()
    return () => {
      cancelled = true
    }
  }, [cashflowPeriod, refreshKey])

  useEffect(() => {
    let cancelled = false

    const loadCategory = async () => {
      try {
        setCategoryLoading(true)
        setCategoryError('')
        const data = await getCategoryPerformanceReport(categoryPeriod)
        if (!cancelled) {
          setCategoryReport(data)
        }
      } catch (error) {
        if (!cancelled) {
          setCategoryError(getApiErrorMessage(error, 'Unable to load category performance report'))
        }
      } finally {
        if (!cancelled) {
          setCategoryLoading(false)
        }
      }
    }

    loadCategory()
    return () => {
      cancelled = true
    }
  }, [categoryPeriod, refreshKey])

  useEffect(() => {
    let cancelled = false

    const loadCustomer = async () => {
      try {
        setCustomerLoading(true)
        setCustomerError('')
        const data = await getCustomerInsightsReport(customerPeriod)
        if (!cancelled) {
          setCustomerReport(data)
        }
      } catch (error) {
        if (!cancelled) {
          setCustomerError(getApiErrorMessage(error, 'Unable to load customer movement report'))
        }
      } finally {
        if (!cancelled) {
          setCustomerLoading(false)
        }
      }
    }

    loadCustomer()
    return () => {
      cancelled = true
    }
  }, [customerPeriod, refreshKey])

  useEffect(() => {
    let cancelled = false

    const loadPayment = async () => {
      try {
        setPaymentLoading(true)
        setPaymentError('')
        const data = await getPaymentInsightsReport(paymentPeriod)
        if (!cancelled) {
          setPaymentReport(data)
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentError(getApiErrorMessage(error, 'Unable to load payment health report'))
        }
      } finally {
        if (!cancelled) {
          setPaymentLoading(false)
        }
      }
    }

    loadPayment()
    return () => {
      cancelled = true
    }
  }, [paymentPeriod, refreshKey])

  const applyPeriod = (setter: React.Dispatch<React.SetStateAction<ReportPeriod>>) =>
    (period: ReportPeriod) => {
      setter(period)
      saveActiveReportsPeriod(period)
    }

  const heroMetrics = useMemo(
    () => [
      {
        label: 'Collection Rate',
        value: formatPercent(summary?.collection_rate || 0),
        hint: 'captured from billed revenue',
      },
      {
        label: 'Receivables',
        value: formatCompactCurrency(summary?.outstanding_receivables || 0),
        hint: 'customer balances in pipeline',
      },
      {
        label: 'Payables',
        value: formatCompactCurrency(summary?.outstanding_payables || 0),
        hint: 'vendor dues to settle',
      },
    ],
    [summary],
  )

  return (
      <div className="mx-auto w-full max-w-[1600px] space-y-8 px-1 py-2 sm:px-2">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-indigo-100/80 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_transparent_32%),linear-gradient(135deg,_#eef2ff_0%,_#dbeafe_40%,_#c7d2fe_100%)] px-6 py-8 text-slate-950 shadow-[0_24px_70px_rgba(99,102,241,0.16)] dark:border-indigo-900/60 dark:bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.24),_transparent_28%),linear-gradient(135deg,_#172554_0%,_#312e81_54%,_#1d4ed8_100%)] dark:text-white sm:px-8 lg:px-10">
          <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-white/50 blur-3xl dark:bg-white/10" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-blue-300/60 blur-3xl dark:bg-cyan-400/20" />

          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/82 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-sm dark:border-white/15 dark:bg-white/10 dark:text-indigo-100">
                <BarChart3 size={14} />
                Reports Intelligence
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Read the business like an operator, not just a bookkeeper.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base dark:text-indigo-100/85">
                Follow revenue momentum, cash discipline, category efficiency, customer repeat behavior,
                and payment health from one responsive analytics workspace.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRefreshKey((current) => current + 1)}
                  className="inline-flex h-12 items-center gap-2 rounded-[1.2rem] border border-indigo-200 bg-white/88 px-4 text-sm font-bold text-slate-700 shadow-[0_12px_24px_rgba(99,102,241,0.10)] transition hover:-translate-y-[1px] hover:border-indigo-300 hover:text-indigo-700 dark:border-white/15 dark:bg-white/10 dark:text-white"
                >
                  <RefreshCcw size={16} />
                  Refresh Reports
                </button>
                <div className="inline-flex items-center gap-2 rounded-[1.2rem] border border-white/40 bg-white/60 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-indigo-600 dark:border-white/10 dark:bg-white/10 dark:text-indigo-100/85">
                  <TrendingUp size={15} />
                  Multi-period analytics engine
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              {heroMetrics.map((item) => (
                <HeroMetric key={item.label} label={item.label} value={item.value} hint={item.hint} />
              ))}
            </div>
          </div>
        </section>

        {summaryError ? (
          <div className="rounded-[1.75rem] border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            {summaryError}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Revenue"
            value={summaryLoading ? '...' : formatCompactCurrency(summary?.total_revenue || 0)}
            hint="all billed sales"
            icon={<CircleDollarSign size={19} />}
            tone="indigo"
          />
          <SummaryCard
            title="Profit"
            value={summaryLoading ? '...' : formatCompactCurrency(summary?.total_profit || 0)}
            hint={summaryLoading ? 'Loading' : `${formatCompactCurrency(summary?.net_profit || 0)} net after expenses`}
            icon={<ArrowUpRight size={19} />}
            tone="emerald"
          />
          <SummaryCard
            title="Expenses"
            value={summaryLoading ? '...' : formatCompactCurrency(summary?.total_expenses || 0)}
            hint="operating outflow tracked"
            icon={<ArrowDownRight size={19} />}
            tone="rose"
          />
          <SummaryCard
            title="Avg Order Value"
            value={summaryLoading ? '...' : formatCompactCurrency(summary?.average_order_value || 0)}
            hint="per invoice average"
            icon={<Wallet size={19} />}
            tone="indigo"
          />
          <SummaryCard
            title="Active Customers"
            value={summaryLoading ? '...' : formatNumber(summary?.active_customers || 0)}
            hint={summaryLoading ? 'Loading' : `${formatNumber(summary?.total_customers || 0)} total customers`}
            icon={<Users size={19} />}
            tone="violet"
          />
        </section>

        <section className="grid items-stretch gap-5 xl:grid-cols-[1.28fr_0.92fr]">
          <SalesProfitPanel
            report={salesReport}
            loading={salesLoading}
            error={salesError}
            period={salesPeriod}
            onPeriodChange={applyPeriod(setSalesPeriod)}
          />
          <CashflowPanel
            report={cashflowReport}
            loading={cashflowLoading}
            error={cashflowError}
            period={cashflowPeriod}
            onPeriodChange={applyPeriod(setCashflowPeriod)}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr]">
          <CategoryPerformancePanel
            report={categoryReport}
            loading={categoryLoading}
            error={categoryError}
            period={categoryPeriod}
            onPeriodChange={applyPeriod(setCategoryPeriod)}
          />
          <CustomerInsightsPanel
            report={customerReport}
            loading={customerLoading}
            error={customerError}
            period={customerPeriod}
            onPeriodChange={applyPeriod(setCustomerPeriod)}
          />
        </section>

        <PaymentHealthPanel
          report={paymentReport}
          loading={paymentLoading}
          error={paymentError}
          period={paymentPeriod}
          onPeriodChange={applyPeriod(setPaymentPeriod)}
        />
      </div>
  )
}

function HeroMetric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[1.65rem] border border-indigo-100/70 bg-white/74 px-4 py-4 shadow-sm backdrop-blur-sm dark:border-white/15 dark:bg-white/10">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-100/72">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-indigo-100/72">{hint}</p>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  hint,
  icon,
  tone,
}: {
  title: string
  value: string
  hint: string
  icon: React.ReactNode
  tone: 'indigo' | 'emerald' | 'rose' | 'blue' | 'violet'
}) {
  const toneClassNames = {
    indigo: 'from-indigo-500/18 to-blue-500/10 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300',
    emerald: 'from-emerald-500/18 to-teal-500/10 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
    rose: 'from-rose-500/18 to-orange-500/10 text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300',
    blue: 'from-sky-500/18 to-indigo-500/10 text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300',
    violet: 'from-violet-500/18 to-indigo-500/10 text-violet-700 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300',
  }

  return (
    <div className="rounded-[1.9rem] border border-white/70 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{hint}</p>
        </div>

        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${toneClassNames[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: ReportPeriod
  onChange: (period: ReportPeriod) => void
}) {
  return (
    <div className="w-full md:max-w-[420px] 2xl:max-w-none">
      <div className="relative md:hidden">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as ReportPeriod)}
          className="h-11 w-full appearance-none rounded-[1.15rem] border border-indigo-100 bg-white/95 pl-4 pr-11 text-sm font-bold text-slate-700 shadow-[0_12px_24px_rgba(99,102,241,0.10)] outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950"
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300"
        />
      </div>

      <div className="hidden w-full grid-cols-4 gap-1 rounded-[1.05rem] border border-indigo-100 bg-[linear-gradient(135deg,_rgba(238,242,255,0.96)_0%,_rgba(255,255,255,0.98)_100%)] p-1 shadow-[0_14px_30px_rgba(99,102,241,0.10)] md:grid dark:border-slate-700 dark:bg-[linear-gradient(135deg,_rgba(30,41,59,0.96)_0%,_rgba(15,23,42,0.96)_100%)]">
        {periodOptions.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.value)}
              className={`flex h-9 items-center justify-center rounded-[0.8rem] text-[11px] font-black uppercase tracking-[0.02em] transition ${
                active
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-[0_10px_24px_rgba(79,70,229,0.20)]'
                  : 'text-slate-600 hover:bg-white hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              {option.initial}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PanelShell({
  eyebrow,
  title,
  description,
  period,
  onPeriodChange,
  children,
  className = '',
}: {
  eyebrow: string
  title: string
  description: string
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex h-full flex-col rounded-[2rem] border border-white/60 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 sm:p-7 ${className}`}>
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">{eyebrow}</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>
        </div>

        <PeriodToggle value={period} onChange={onPeriodChange} />
      </div>

      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </div>
  )
}

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-[1.6rem] border border-dashed border-indigo-100 bg-slate-50/80 px-4 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
      {message}
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.6rem] border border-rose-100 bg-rose-50 px-4 py-10 text-center text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
      {message}
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-indigo-100 bg-slate-50/80 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
      {message}
    </div>
  )
}

function SalesProfitPanel({
  report,
  loading,
  error,
  period,
  onPeriodChange,
}: {
  report: SalesProfitReport | null
  loading: boolean
  error: string
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
}) {
  const points = report?.points || []
  const maxValue = Math.max(...points.flatMap((point) => [point.revenue, point.profit]), 1)
  const hasData = points.some((point) => point.revenue > 0 || point.profit > 0)

  const strongestRevenuePoint = points.reduce(
    (best, point) => (point.revenue > best.revenue ? point : best),
    points[0] || { label: '-', revenue: 0, profit: 0, expenses: 0, collections: 0, outstanding: 0, net: 0 },
  )
  const strongestProfitPoint = points.reduce(
    (best, point) => (point.profit > best.profit ? point : best),
    points[0] || { label: '-', revenue: 0, profit: 0, expenses: 0, collections: 0, outstanding: 0, net: 0 },
  )
  const strongestMarginPoint = points.reduce(
    (best, point) => {
      const bestMargin = best.revenue > 0 ? best.profit / best.revenue : 0
      const pointMargin = point.revenue > 0 ? point.profit / point.revenue : 0
      return pointMargin > bestMargin ? point : best
    },
    points[0] || { label: '-', revenue: 0, profit: 0, expenses: 0, collections: 0, outstanding: 0, net: 0 },
  )
  const strongestMargin = strongestMarginPoint.revenue > 0
    ? (strongestMarginPoint.profit / strongestMarginPoint.revenue) * 100
    : 0

  return (
    <PanelShell
      eyebrow="Revenue Engine"
      title="Revenue vs profit"
      description="See where topline momentum is building and how efficiently it converts into profit."
      period={period}
      onPeriodChange={onPeriodChange}
      className="xl:min-h-[690px]"
    >
      {loading ? <LoadingPanel message="Loading revenue and profit trend..." /> : null}
      {!loading && error ? <ErrorPanel message={error} /> : null}
      {!loading && !error && !hasData ? <EmptyPanel message="No sales or profit data is available for this period." /> : null}

      {!loading && !error && hasData ? (
        <div className="flex h-full flex-col">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <StatPill label="Revenue" value={formatCompactCurrency(report?.total_revenue || 0)} tone="indigo" />
            <StatPill label="Profit" value={formatCompactCurrency(report?.total_profit || 0)} tone="emerald" />
            <StatPill label="Margin" value={formatPercent(report?.profit_margin || 0)} tone="violet" />
          </div>

          <div className="rounded-[1.7rem] bg-[linear-gradient(180deg,_rgba(238,242,255,0.86)_0%,_rgba(255,255,255,0.98)_100%)] px-3 pb-4 pt-5 dark:bg-[linear-gradient(180deg,_rgba(30,41,59,0.76)_0%,_rgba(15,23,42,0.96)_100%)] sm:px-5">
            <div className="mb-4 flex items-center justify-end gap-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> Revenue
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Profit
              </div>
            </div>

            <div className="relative h-[250px]">
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-px bg-slate-200/70 dark:bg-slate-700/70" />
                ))}
              </div>

              <div
                className="absolute inset-0 pb-8"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
                  gap: '8px',
                }}
              >
                {points.map((point) => {
                  const revenueHeight = Math.max((point.revenue / maxValue) * 100, point.revenue > 0 ? 8 : 0)
                  const profitHeight = Math.max((point.profit / maxValue) * 100, point.profit > 0 ? 6 : 0)
                  const pointMargin = point.revenue > 0 ? (point.profit / point.revenue) * 100 : 0

                  return (
                    <div key={point.label} className="group flex h-full flex-col items-center justify-end">
                      <div className="mb-2 flex min-h-10 flex-col items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="rounded-full bg-slate-950 px-2 py-1 text-[9px] font-black text-white dark:bg-slate-100 dark:text-slate-900">
                          {formatCompactCurrency(point.revenue)}
                        </span>
                        <span className="rounded-full bg-emerald-500 px-2 py-1 text-[9px] font-black text-white">
                          {formatCompactCurrency(point.profit)}
                        </span>
                      </div>

                      <div className="flex h-full w-full items-end justify-center gap-1.5">
                        <div
                          className="w-[38%] max-w-[22px] rounded-t-2xl bg-gradient-to-t from-indigo-700 via-indigo-500 to-blue-400 shadow-[0_10px_24px_rgba(79,70,229,0.24)] transition group-hover:-translate-y-1"
                          style={{ height: `${revenueHeight}%` }}
                          title={`${point.label} revenue ${formatCurrency(point.revenue)}`}
                        />
                        <div
                          className="w-[38%] max-w-[22px] rounded-t-2xl bg-gradient-to-t from-emerald-600 to-emerald-300 transition group-hover:-translate-y-1"
                          style={{ height: `${profitHeight}%` }}
                          title={`${point.label} profit ${formatCurrency(point.profit)}`}
                        />
                      </div>

                      <div className="mt-3 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          {point.label}
                        </span>
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                          M {formatPercent(pointMargin)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <DataTile label="Best Revenue" value={`${strongestRevenuePoint.label} ${formatCompactCurrency(strongestRevenuePoint.revenue)}`} tone="indigo" />
            <DataTile label="Best Profit" value={`${strongestProfitPoint.label} ${formatCompactCurrency(strongestProfitPoint.profit)}`} tone="emerald" />
            <DataTile label="Best Margin" value={`${strongestMarginPoint.label} ${formatPercent(strongestMargin)}`} tone="violet" />
          </div>
        </div>
      ) : null}
    </PanelShell>
  )
}

function CashflowPanel({
  report,
  loading,
  error,
  period,
  onPeriodChange,
}: {
  report: CashflowReport | null
  loading: boolean
  error: string
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
}) {
  const points = report?.points || []
  const maxValue = Math.max(...points.flatMap((point) => [point.collections, point.expenses]), 1)
  const hasData = points.some((point) => point.collections > 0 || point.expenses > 0 || point.outstanding > 0)

  const strongestCollectionPoint = points.reduce(
    (best, point) => (point.collections > best.collections ? point : best),
    points[0] || { label: '-', collections: 0, expenses: 0, outstanding: 0, net: 0, revenue: 0, profit: 0 },
  )
  const strongestExpensePoint = points.reduce(
    (best, point) => (point.expenses > best.expenses ? point : best),
    points[0] || { label: '-', collections: 0, expenses: 0, outstanding: 0, net: 0, revenue: 0, profit: 0 },
  )

  return (
    <PanelShell
      eyebrow="Cash Discipline"
      title="Collections vs expenses"
      description="Track what actually came in, what went out, and how much customer balance is still open."
      period={period}
      onPeriodChange={onPeriodChange}
      className="xl:min-h-[690px]"
    >
      {loading ? <LoadingPanel message="Loading cashflow signals..." /> : null}
      {!loading && error ? <ErrorPanel message={error} /> : null}
      {!loading && !error && !hasData ? <EmptyPanel message="No cashflow activity is available for this period." /> : null}

      {!loading && !error && hasData ? (
        <div className="flex h-full flex-col">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <DataTile label="Collections" value={formatCompactCurrency(report?.total_collections || 0)} tone="indigo" />
            <DataTile label="Expenses" value={formatCompactCurrency(report?.total_expenses || 0)} tone="rose" />
            <DataTile label="Net Cashflow" value={formatCompactCurrency(report?.net_cashflow || 0)} tone="emerald" />
          </div>

          <div className="rounded-[1.7rem] bg-[linear-gradient(180deg,_rgba(238,242,255,0.86)_0%,_rgba(255,255,255,0.98)_100%)] px-3 pb-4 pt-5 dark:bg-[linear-gradient(180deg,_rgba(30,41,59,0.76)_0%,_rgba(15,23,42,0.96)_100%)] sm:px-5">
            <div className="mb-4 flex items-center justify-end gap-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Collections
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Expenses
              </div>
            </div>

            <div className="relative h-[250px]">
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-px bg-slate-200/70 dark:bg-slate-700/70" />
                ))}
              </div>

              <div
                className="absolute inset-0 pb-8"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
                  gap: '8px',
                }}
              >
                {points.map((point) => {
                  const collectionsHeight = Math.max((point.collections / maxValue) * 100, point.collections > 0 ? 7 : 0)
                  const expensesHeight = Math.max((point.expenses / maxValue) * 100, point.expenses > 0 ? 7 : 0)
                  const positiveNet = point.net >= 0

                  return (
                    <div key={point.label} className="group flex h-full flex-col items-center justify-end">
                      <div className="mb-2 flex min-h-10 flex-col items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="rounded-full bg-slate-950 px-2 py-1 text-[9px] font-black text-white dark:bg-slate-100 dark:text-slate-900">
                          {formatCompactCurrency(point.collections)}
                        </span>
                        <span className="rounded-full bg-orange-500 px-2 py-1 text-[9px] font-black text-white">
                          {formatCompactCurrency(point.expenses)}
                        </span>
                      </div>

                      <div className="flex h-full w-full items-end justify-center gap-1.5">
                        <div
                          className="w-[38%] max-w-[22px] rounded-t-2xl bg-gradient-to-t from-blue-600 via-indigo-500 to-sky-300 shadow-[0_10px_24px_rgba(59,130,246,0.22)] transition group-hover:-translate-y-1"
                          style={{ height: `${collectionsHeight}%` }}
                          title={`${point.label} collections ${formatCurrency(point.collections)}`}
                        />
                        <div
                          className="w-[38%] max-w-[22px] rounded-t-2xl bg-gradient-to-t from-rose-500 via-orange-400 to-amber-300 transition group-hover:-translate-y-1"
                          style={{ height: `${expensesHeight}%` }}
                          title={`${point.label} expenses ${formatCurrency(point.expenses)}`}
                        />
                      </div>

                      <div className="mt-3 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          {point.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] ${positiveNet ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                          {positiveNet ? 'Net +' : 'Net '}{formatCompactCurrency(Math.abs(point.net))}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <DataTile label="Best Collection" value={`${strongestCollectionPoint.label} ${formatCompactCurrency(strongestCollectionPoint.collections)}`} tone="indigo" />
            <DataTile label="Peak Expense" value={`${strongestExpensePoint.label} ${formatCompactCurrency(strongestExpensePoint.expenses)}`} tone="rose" />
            <DataTile label="Receivables" value={formatCompactCurrency(report?.outstanding_receivables || 0)} tone="amber" />
          </div>
        </div>
      ) : null}
    </PanelShell>
  )
}

function CategoryPerformancePanel({
  report,
  loading,
  error,
  period,
  onPeriodChange,
}: {
  report: CategoryPerformanceReport | null
  loading: boolean
  error: string
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
}) {
  const items = report?.items || []
  const maxRevenue = Math.max(...items.map((item) => item.revenue), 1)

  return (
    <PanelShell
      eyebrow="Category Strength"
      title="Category performance"
      description="Identify which product groups are pulling revenue, volume, and profit in the selected window."
      period={period}
      onPeriodChange={onPeriodChange}
    >
      {loading ? <LoadingPanel message="Loading category performance..." /> : null}
      {!loading && error ? <ErrorPanel message={error} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyPanel message="No category sales data is available for this period." /> : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <StatPill label="Top Category" value={report?.top_category || 'N/A'} tone="indigo" />
            <StatPill label="Tracked Categories" value={formatNumber(items.length)} tone="indigo" />
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const revenueWidth = Math.max((item.revenue / maxRevenue) * 100, item.revenue > 0 ? 14 : 0)
              return (
                <div key={`${item.category}-${index}`} className="rounded-[1.5rem] bg-slate-50/90 p-4 dark:bg-slate-800/70">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-xs font-black text-white shadow-[0_12px_24px_rgba(79,70,229,0.24)]">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950 dark:text-white">{item.category}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {formatNumber(item.orders)} orders · {formatNumber(item.quantity)} units
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Revenue</p>
                        <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">{formatCompactCurrency(item.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Profit</p>
                        <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-300">{formatCompactCurrency(item.profit)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-400" style={{ width: `${revenueWidth}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </PanelShell>
  )
}

function CustomerInsightsPanel({
  report,
  loading,
  error,
  period,
  onPeriodChange,
}: {
  report: CustomerInsightsReport | null
  loading: boolean
  error: string
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
}) {
  const points = report?.points || []
  const maxTotal = Math.max(...points.map((point) => point.new_customers + point.repeat_customers), 1)
  const hasData = points.some((point) => point.new_customers > 0 || point.repeat_customers > 0)

  return (
    <PanelShell
      eyebrow="Customer Momentum"
      title="New vs repeat buyers"
      description="Watch whether growth is being driven by acquisition, retention, or a healthier repeat revenue mix."
      period={period}
      onPeriodChange={onPeriodChange}
    >
      {loading ? <LoadingPanel message="Loading customer movement report..." /> : null}
      {!loading && error ? <ErrorPanel message={error} /> : null}
      {!loading && !error && !hasData ? <EmptyPanel message="No customer movement data is available for this period." /> : null}

      {!loading && !error && hasData ? (
        <div className="flex h-full flex-col">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <DataTile label="Repeat Rate" value={formatPercent(report?.repeat_rate || 0)} tone="violet" />
            <DataTile label="Repeat Revenue" value={formatCompactCurrency(report?.repeat_revenue || 0)} tone="indigo" />
            <DataTile label="New Customers" value={formatNumber(report?.total_new_customers || 0)} tone="emerald" />
          </div>

          <div className="space-y-3">
            {points.map((point) => {
              const total = point.new_customers + point.repeat_customers
              const totalWidth = Math.max((total / maxTotal) * 100, total > 0 ? 16 : 0)
              const newWidth = total > 0 ? (point.new_customers / total) * 100 : 0
              const repeatWidth = total > 0 ? 100 - newWidth : 0

              return (
                <div key={point.label} className="rounded-[1.5rem] bg-slate-50/90 p-4 dark:bg-slate-800/70">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950 dark:text-white">{point.label}</p>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {formatNumber(total)} customers
                    </p>
                  </div>

                  <div className="rounded-full bg-slate-200 p-1 dark:bg-slate-700">
                    <div className="flex h-4 overflow-hidden rounded-full" style={{ width: `${totalWidth}%` }}>
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${newWidth}%` }} />
                      <div className="bg-gradient-to-r from-indigo-600 to-blue-500" style={{ width: `${repeatWidth}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <span>New {formatNumber(point.new_customers)}</span>
                    <span>Repeat {formatNumber(point.repeat_customers)}</span>
                    <span className="text-indigo-600 dark:text-indigo-300">Revenue {formatCompactCurrency(point.repeat_revenue)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </PanelShell>
  )
}

function PaymentHealthPanel({
  report,
  loading,
  error,
  period,
  onPeriodChange,
}: {
  report: PaymentInsightsReport | null
  loading: boolean
  error: string
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
}) {
  const statuses = report?.statuses || []
  const hasData = statuses.some((item) => item.count > 0 || item.amount > 0)

  const toneClassNames: Record<string, string> = {
    PAID: 'from-emerald-500 to-teal-400',
    PARTIAL: 'from-indigo-600 to-blue-500',
    PENDING: 'from-amber-500 to-orange-400',
    OVERDUE: 'from-rose-600 to-red-500',
  }

  return (
    <PanelShell
      eyebrow="Payment Health"
      title="Collection exposure by status"
      description="Prioritize follow-ups using billed exposure, collected cash, pending balances, and overdue risk."
      period={period}
      onPeriodChange={onPeriodChange}
    >
      {loading ? <LoadingPanel message="Loading payment health analytics..." /> : null}
      {!loading && error ? <ErrorPanel message={error} /> : null}
      {!loading && !error && !hasData ? <EmptyPanel message="No payment activity is available for this period." /> : null}

      {!loading && !error && hasData ? (
        <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <DataTile label="Collected" value={formatCompactCurrency(report?.collected_amount || 0)} tone="emerald" />
            <DataTile label="Outstanding" value={formatCompactCurrency(report?.outstanding_amount || 0)} tone="amber" />
            <DataTile label="Overdue" value={formatCompactCurrency(report?.overdue_amount || 0)} tone="rose" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {statuses.map((item) => (
              <div key={item.status} className="rounded-[1.5rem] bg-slate-50/90 p-4 dark:bg-slate-800/70">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.status}</p>
                  <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${toneClassNames[item.status] || 'from-slate-500 to-slate-400'}`} />
                </div>
                <p className="mt-4 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{formatCompactCurrency(item.amount)}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{formatNumber(item.count)} invoices</p>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${toneClassNames[item.status] || 'from-slate-500 to-slate-400'}`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {formatPercent(item.percentage)} of billed exposure
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </PanelShell>
  )
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'indigo' | 'emerald' | 'violet' | 'blue'
}) {
  const toneClassNames = {
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  }

  return (
    <div className={`rounded-full px-4 py-2 ${toneClassNames[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-75">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

function DataTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'indigo' | 'emerald' | 'rose' | 'violet' | 'amber'
}) {
  const toneClassNames = {
    indigo: 'from-indigo-500/15 to-blue-500/8 text-indigo-700 dark:text-indigo-300',
    emerald: 'from-emerald-500/15 to-teal-500/8 text-emerald-700 dark:text-emerald-300',
    rose: 'from-rose-500/15 to-orange-500/8 text-rose-700 dark:text-rose-300',
    violet: 'from-violet-500/15 to-indigo-500/8 text-violet-700 dark:text-violet-300',
    amber: 'from-amber-500/15 to-orange-500/8 text-amber-700 dark:text-amber-300',
  }

  return (
    <div className={`rounded-[1.45rem] border border-white/70 bg-gradient-to-br ${toneClassNames[tone]} px-4 py-4 dark:border-slate-700/80`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}

