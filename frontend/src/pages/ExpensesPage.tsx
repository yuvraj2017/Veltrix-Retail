import {
  ArrowUpRight,
  CalendarRange,
  Filter,
  IndianRupee,
  PlusCircle,
  ReceiptText,
  Search,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ExpenseFormModal } from '../components/expenses/ExpenseFormModal'
import { ExpenseSelect } from '../components/expenses/ExpenseSelect'
import { ExpensesTable } from '../components/expenses/ExpensesTable'
import { AppShell } from '../components/layout/AppShell'
import { createExpense, deleteExpense, getExpenseAnalytics, getExpenses, updateExpense } from '../features/expenses/api'
import { expenseCategories, paymentModes, type ExpenseFormValues } from '../features/expenses/schemas'
import type { Expense, ExpenseAnalytics, ExpensePayload, ExpenseRange } from '../features/expenses/types'
import { getApiErrorMessage } from '../lib/api-error'

const emptyAnalytics: ExpenseAnalytics = {
  selected_range: 'all',
  weekly_total: 0,
  weekly_count: 0,
  monthly_total: 0,
  monthly_count: 0,
  range_total: 0,
  range_count: 0,
  average_expense: 0,
  categories: [],
  trend: [],
}

const rangeOptions: Array<{ label: string; value: ExpenseRange }> = [
  { label: 'All Expenses', value: 'all' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
]

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const compactValueFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0))
const formatCompactValue = (value: string | number) => compactValueFormatter.format(Number(value || 0))
const toNumber = (value: string | number) => Number(value || 0)
const getRangeHeading = (range: ExpenseRange) => {
  if (range === 'week') return 'This Week'
  if (range === 'month') return 'This Month'
  return 'All Expenses'
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [analytics, setAnalytics] = useState<ExpenseAnalytics>(emptyAnalytics)
  const [range, setRange] = useState<ExpenseRange>('all')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [paymentModeFilter, setPaymentModeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const maxTrendValue = useMemo(
    () => Math.max(...analytics.trend.map((point) => point.total), 1),
    [analytics.trend]
  )
  const averageTrendValue = useMemo(() => {
    if (analytics.trend.length === 0) return 0
    return analytics.trend.reduce((sum, point) => sum + point.total, 0) / analytics.trend.length
  }, [analytics.trend])
  const peakTrendPoint = useMemo(() => {
    if (analytics.trend.length === 0) return null
    return analytics.trend.reduce((peak, point) => (point.total > peak.total ? point : peak))
  }, [analytics.trend])
  const trendTicks = useMemo(
    () =>
      [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
        ratio,
        value: maxTrendValue * ratio,
      })),
    [maxTrendValue]
  )

  const displayedCategories = useMemo(
    () => Array.from(new Set([...expenseCategories, ...expenses.map((expense) => expense.category)])).sort(),
    [expenses]
  )

  const categoryOptions = useMemo(
    () => [{ label: 'All categories', value: '' }, ...displayedCategories.map((category) => ({ label: category, value: category }))],
    [displayedCategories]
  )

  const paymentModeOptions = useMemo(
    () => [{ label: 'All payment modes', value: '' }, ...paymentModes.map((mode) => ({ label: mode, value: mode }))],
    []
  )

  const loadExpensesList = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await getExpenses({
        range,
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
        payment_mode: paymentModeFilter || undefined,
      })
      setExpenses(data.items)
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Failed to load expenses.'))
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true)
      const data = await getExpenseAnalytics(range)
      setAnalytics(data)
    } catch (analyticsError) {
      console.error('Failed to load expense analytics', analyticsError)
      setAnalytics(emptyAnalytics)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  useEffect(() => {
    void loadAnalytics()
  }, [range])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadExpensesList()
    }, search ? 250 : 0)

    return () => clearTimeout(timer)
  }, [range, search, categoryFilter, paymentModeFilter])

  const refreshAll = async () => {
    await Promise.all([loadExpensesList(), loadAnalytics()])
  }

  const handleOpenCreate = () => {
    setSelectedExpense(null)
    setModalError('')
    setModalOpen(true)
  }

  const handleOpenEdit = (expense: Expense) => {
    setSelectedExpense(expense)
    setModalError('')
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedExpense(null)
    setModalError('')
  }

  const handleSaveExpense = async (values: ExpenseFormValues) => {
    const payload: ExpensePayload = {
      title: values.title,
      category: values.category,
      amount: Number(values.amount),
      expense_date: values.expense_date,
      payment_mode: values.payment_mode,
      notes: values.notes?.trim() ? values.notes.trim() : null,
    }

    try {
      setSubmitLoading(true)
      setModalError('')

      if (selectedExpense) {
        await updateExpense(selectedExpense.id, payload)
      } else {
        await createExpense(payload)
      }

      handleCloseModal()
      await refreshAll()
    } catch (saveError) {
      setModalError(getApiErrorMessage(saveError, 'Failed to save expense.'))
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDeleteExpense = async (expense: Expense) => {
    const confirmed = window.confirm(`Delete expense "${expense.title}"?`)
    if (!confirmed) return

    try {
      setDeletingId(expense.id)
      await deleteExpense(expense.id)
      await refreshAll()
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, 'Failed to delete expense.'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-2 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_14px_34px_rgba(79,70,229,0.08)] dark:border-indigo-900/50 dark:bg-slate-800/80 dark:text-indigo-400 dark:shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              Business Expense Ledger
            </div>
            <h1 className="mt-4 text-[40px] font-black tracking-[-0.04em] text-slate-950 dark:text-slate-100 sm:text-[52px]">
              Expenses
            </h1>
            <p className="mt-3 max-w-2xl text-[17px] leading-8 text-slate-600 dark:text-slate-400">
              Track fixed and variable outgoings across rent, utilities, salaries, maintenance,
              and miscellaneous business spending without leaving your main workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="group inline-flex h-14 items-center justify-center gap-3 rounded-[1.5rem] bg-gradient-to-r from-[#5841f0] via-[#4f46e5] to-[#3730a3] px-6 text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.28)] transition hover:-translate-y-[1px]"
          >
            <PlusCircle size={18} />
            Add Expense
            <ArrowUpRight size={17} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-[1.75rem] border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 shadow-sm dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <section className="rounded-[2rem] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:bg-slate-900 dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    range === option.value
                      ? 'bg-indigo-600 text-white shadow-[0_14px_32px_rgba(79,70,229,0.24)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Filter size={14} />
              {getRangeHeading(range)} view active
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: range === 'week' ? 'Weekly Total' : range === 'month' ? 'Monthly Total' : 'Total Expenses',
              value: formatCurrency(analytics.range_total),
              helper: `${analytics.range_count} entries in ${getRangeHeading(range).toLowerCase()}`,
              icon: Wallet,
              tone: 'from-[#4f46e5] to-[#7c3aed]',
            },
            {
              title: 'This Week',
              value: formatCurrency(analytics.weekly_total),
              helper: `${analytics.weekly_count} recorded expenses`,
              icon: CalendarRange,
              tone: 'from-[#0f766e] to-[#0d9488]',
            },
            {
              title: 'This Month',
              value: formatCurrency(analytics.monthly_total),
              helper: `${analytics.monthly_count} recorded expenses`,
              icon: ReceiptText,
              tone: 'from-[#c2410c] to-[#ea580c]',
            },
            {
              title: 'Average Expense',
              value: formatCurrency(analytics.average_expense),
              helper: 'Based on the current selected view',
              icon: IndianRupee,
              tone: 'from-[#1d4ed8] to-[#2563eb]',
            },
          ].map((card) => {
            const Icon = card.icon
            return (
              <div key={card.title} className="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:bg-slate-900 dark:shadow-[0_20px_55px_rgba(0,0,0,0.28)]">
                <div className={`h-1.5 bg-gradient-to-r ${card.tone}`} />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        {card.title}
                      </p>
                      <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">
                        {analyticsLoading ? '...' : card.value}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{card.helper}</p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-gradient-to-br ${card.tone} text-white shadow-lg`}>
                      <Icon size={22} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <section className="rounded-[2rem] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:bg-slate-900 dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">Expense Activity</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">
                  Spending Trend
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {range === 'all'
                    ? 'Recent six-month view of your expense flow.'
                    : `Detailed ${getRangeHeading(range).toLowerCase()} spending movement.`}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {getRangeHeading(range)}
              </span>
            </div>

            {analyticsLoading ? (
              <div className="mt-6 h-[280px] animate-pulse rounded-[1.75rem] bg-slate-100 dark:bg-slate-800" />
            ) : analytics.trend.length === 0 ? (
              <div className="mt-6 flex h-[280px] items-center justify-center rounded-[1.75rem] bg-slate-50 text-sm font-medium text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                No expense trend data available yet.
              </div>
            ) : (
              <div className="mt-6 rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:p-5">
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Peak</p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-slate-100">
                      {peakTrendPoint ? `${peakTrendPoint.label} - ${formatCurrency(peakTrendPoint.total)}` : 'No data available'}
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Average</p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-slate-100">{formatCurrency(averageTrendValue)}</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Periods</p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-slate-100">{analytics.trend.length} tracked</p>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <div className="min-w-[540px]">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[64px_minmax(0,1fr)]">
                      <div className="hidden h-[260px] flex-col justify-between pb-9 sm:flex">
                        {trendTicks.map((tick) => (
                          <span key={tick.ratio} className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            {formatCompactValue(tick.value)}
                          </span>
                        ))}
                      </div>

                      <div className="relative h-[260px]">
                        <div className="absolute inset-0">
                          {trendTicks.map((tick) => (
                            <div
                              key={tick.ratio}
                              className="absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-slate-700"
                              style={{ bottom: `${tick.ratio * 100}%` }}
                            />
                          ))}

                          {averageTrendValue > 0 && (
                            <div
                              className="absolute inset-x-0 border-t border-indigo-200"
                              style={{ bottom: `${Math.min((averageTrendValue / maxTrendValue) * 100, 100)}%` }}
                            >
                              <span className="absolute -top-3 right-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:bg-slate-800 dark:text-indigo-400">
                                Avg
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="absolute inset-x-0 bottom-0 top-0 flex items-end gap-3 sm:gap-4">
                          {analytics.trend.map((point) => {
                            const isPeak = peakTrendPoint?.label === point.label && peakTrendPoint?.total === point.total
                            const barHeight = Math.max((point.total / maxTrendValue) * 100, point.total > 0 ? 12 : 6)

                            return (
                              <div key={point.label} className="flex min-w-0 flex-1 flex-col justify-end">
                                <p className={`mb-2 text-center text-[11px] font-black ${isPeak ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {formatCompactValue(point.total)}
                                  </p>
                                <div className="relative flex h-[210px] items-end justify-center">
                                  <div className="absolute inset-x-0 bottom-0 top-0 mx-auto max-w-[72px] rounded-[1.25rem] bg-white dark:bg-slate-800" />
                                  <div
                                    className={`relative w-full max-w-[72px] rounded-[1.25rem] ${isPeak ? 'bg-gradient-to-t from-[#4338ca] via-[#5b4ff5] to-[#9f7aea] shadow-[0_16px_30px_rgba(79,70,229,0.24)]' : 'bg-gradient-to-t from-[#6366f1] to-[#c4b5fd]'}`}
                                    style={{ height: `${barHeight}%` }}
                                    title={`${point.label}: ${formatCurrency(point.total)}`}
                                  />
                                </div>
                                <p className="mt-3 text-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                  {point.label}
                                </p>
                              </div>
                            )
                          })}
                        </div>

                        <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 dark:border-slate-700" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:bg-slate-900 dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">Category Mix</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">
                  Category Breakdown
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  See which categories are driving the largest share of business spending.
                </p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                {analytics.categories.length} categories
              </span>
            </div>

            {analyticsLoading ? (
              <div className="mt-6 space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-[1.5rem] bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : analytics.categories.length === 0 ? (
              <div className="mt-6 flex h-[280px] items-center justify-center rounded-[1.75rem] bg-slate-50 text-center text-sm font-medium text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                Breakdown cards will appear after expenses are recorded.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {analytics.categories.map((category) => (
                  <div key={category.category} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/70">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-black tracking-[-0.02em] text-slate-950 dark:text-slate-100">
                          {category.category}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {category.count} entries
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-slate-950 dark:text-slate-100">
                          {formatCurrency(category.total)}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                          {category.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: `${Math.min(category.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-8 overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:bg-slate-900 dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">Expense Register</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Search, filter, and review every expense entry from the current selected period.
                </p>
              </div>
              {!loading && expenses.length > 0 && (
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Visible total: {formatCurrency(expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0))}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[1.4fr_0.8fr_0.8fr]">
              <div className="relative">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by title, notes, payment mode..."
                  className="h-14 w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/40"
                />
              </div>

              <ExpenseSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={categoryOptions}
                placeholder="All categories"
              />

              <ExpenseSelect
                value={paymentModeFilter}
                onChange={setPaymentModeFilter}
                options={paymentModeOptions}
                placeholder="All payment modes"
              />
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Register View</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Showing {loading ? '...' : expenses.length} matching entries for {getRangeHeading(range).toLowerCase()}.
                </p>
              </div>
            </div>

            <ExpensesTable
              expenses={expenses}
              loading={loading}
              deletingId={deletingId}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteExpense}
            />
          </div>
        </section>
      </div>

      <ExpenseFormModal
        open={modalOpen}
        expense={selectedExpense}
        error={modalError}
        loading={submitLoading}
        onClose={handleCloseModal}
        onSubmit={handleSaveExpense}
      />
    </AppShell>
  )
}
