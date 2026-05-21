import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Download,
  Filter,
  MoreVertical,
  Search,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react'

import { AppShell } from '../../components/layout/AppShell'
import {
  getCustomerAnalyticsStats,
  getCustomerInsights,
  getCustomerLedger,
} from '../../features/customerAnalytics/api'
import type {
  CustomerAnalyticsStats,
  CustomerInsight,
  CustomerLedgerRow,
} from '../../features/customerAnalytics/types'

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatNumber = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatDate = (value?: string | null) => {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function StatusBadge({ status }: { status: CustomerLedgerRow['status'] }) {
  const className =
    status === 'VIP'
      ? 'bg-indigo-50 text-indigo-700 ring-indigo-100'
      : status === 'ACTIVE'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
        : 'bg-slate-100 text-slate-500 ring-slate-200'

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ring-1 ${className}`}
    >
      {status}
    </span>
  )
}

function StatBox({
  title,
  value,
  caption,
  variant = 'light',
}: {
  title: string
  value: string
  caption?: string
  variant?: 'light' | 'primary'
}) {
  if (variant === 'primary') {
    return (
      <div className="relative overflow-hidden rounded-[1.7rem] bg-gradient-to-br from-indigo-700 to-violet-600 p-6 text-white shadow-[0_20px_50px_rgba(79,70,229,0.25)]">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />

        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <WalletCards size={24} />
          </div>

          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/75">
              {title}
            </p>
            <p className="mt-4 text-3xl font-black tracking-tight">{value}</p>
            {caption && (
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-white/60">
                {caption}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-[1.7rem] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-indigo-50 blur-xl" />

      <div className="relative">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </p>
        <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">
          {value}
        </p>
        {caption && (
          <p className="mt-1 text-xs font-semibold text-slate-500">{caption}</p>
        )}
      </div>
    </div>
  )
}

export function CustomersPage() {
  const [stats, setStats] = useState<CustomerAnalyticsStats | null>(null)
  const [rows, setRows] = useState<CustomerLedgerRow[]>([])
  const [insights, setInsights] = useState<CustomerInsight | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  async function loadData() {
    try {
      setIsLoading(true)
      setErrorMessage('')

      const [statsResponse, ledgerResponse, insightsResponse] =
        await Promise.allSettled([
          getCustomerAnalyticsStats(),
          getCustomerLedger({
            search,
            status,
            page,
            limit: 10,
          }),
          getCustomerInsights(),
        ])

      if (statsResponse.status === 'fulfilled') {
        setStats(statsResponse.value)
      }

      if (ledgerResponse.status === 'fulfilled') {
        setRows(ledgerResponse.value.items)
        setTotalPages(ledgerResponse.value.total_pages)
        setTotal(ledgerResponse.value.total)
      } else {
        setRows([])
        setTotalPages(1)
        setTotal(0)
        setErrorMessage(ledgerResponse.reason?.message || 'Unable to load customers.')
      }

      if (insightsResponse.status === 'fulfilled') {
        setInsights(insightsResponse.value)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, status])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      loadData()
    }, 450)

    return () => window.clearTimeout(timer)
  }, [search])

  const showingText = useMemo(() => {
    if (total === 0) return 'Showing 0 customers'

    const start = (page - 1) * 10 + 1
    const end = Math.min(page * 10, total)

    return `Showing ${start}-${end} of ${total} customers`
  }, [page, total])

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer records..."
              className="h-12 w-full rounded-2xl bg-white px-12 text-sm font-medium text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-indigo-50 hover:text-indigo-700">
              <CalendarDays size={17} />
              Last 30 Days
            </button>

            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="h-12 rounded-2xl bg-white px-5 text-sm font-bold text-slate-700 shadow-sm outline-none focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">All Customers</option>
              <option value="VIP">VIP</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <button className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-indigo-50 hover:text-indigo-700">
              <Filter size={17} />
              Filters
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Customer Billing Records
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
            View and manage customers based on their transaction history and invoice data.
            Monitor payment health and engagement tiers.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <StatBox
            title="Total Billed Customers"
            value={formatNumber(stats?.total_billed_customers || 0)}
            caption="customer ledger"
          />
          <StatBox
            title="Average Invoice Value"
            value={formatCurrency(stats?.average_invoice_value || 0)}
            caption="per bill"
          />
          <StatBox
            title="Total Revenue From Customers"
            value={formatCurrency(stats?.total_revenue_from_customers || 0)}
            caption="YTD"
            variant="primary"
          />
        </div>

        <div className="overflow-hidden rounded-[1.8rem] bg-white shadow-[0_16px_42px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between px-6 py-6">
            <h2 className="text-lg font-black text-slate-950">Customer Ledger</h2>

            <div className="flex items-center gap-4 text-slate-600">
              <button className="transition hover:text-indigo-700">
                <Download size={19} />
              </button>
              <button className="transition hover:text-indigo-700">
                <MoreVertical size={19} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="bg-[#f8f9fd]">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Customer Name
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Total Bills
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Total Paid
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Last Invoice
                  </th>
                  <th className="px-6 py-4 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center text-sm font-bold text-slate-500"
                    >
                      Loading customer records...
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center text-sm font-bold text-red-500"
                    >
                      {errorMessage}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center text-sm font-bold text-slate-500"
                    >
                      No customer records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.customer_id} className="transition hover:bg-[#f8f9fd]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-black text-indigo-700">
                            {getInitials(row.customer_name)}
                          </div>

                          <div>
                            <p className="font-bold text-slate-950">
                              {row.customer_name}
                            </p>
                            {row.phone && (
                              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                                {row.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-600">
                        {row.email || '-'}
                      </td>

                      <td className="px-6 py-4 text-sm font-bold text-slate-950">
                        {row.total_bills}
                      </td>

                      <td className="px-6 py-4 text-sm font-black text-slate-950">
                        {formatCurrency(row.total_paid)}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-600">
                        {formatDate(row.last_invoice_date)}
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={row.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/customers/${row.customer_id}`}
                          className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo-700 transition hover:text-indigo-950"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <p className="text-sm font-semibold text-slate-600">{showingText}</p>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                className="h-9 rounded-xl bg-[#f8f9fd] px-3 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>

              <span className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-black text-white">
                {page}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                className="h-9 rounded-xl bg-[#f8f9fd] px-3 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6 rounded-[1.8rem] bg-white p-7 shadow-[0_16px_42px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-slate-950 text-indigo-200">
              <Users size={36} />
            </div>

            <div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-700">
                Growth Insight
              </span>
              <h3 className="mt-4 text-xl font-black text-slate-950">
                {insights?.retention_message ||
                  'Customer retention insights will appear here.'}
              </h3>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                Analyze high-value customers and create targeted offers based on billing
                behavior.
              </p>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-white/70 p-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-indigo-700 shadow-sm">
              <Sparkles size={24} />
            </div>
            <h3 className="mt-5 text-lg font-black text-slate-950">
              Predictive Billing
            </h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Our system is analyzing projected revenue based on current billing trends.
            </p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-4/5 rounded-full bg-indigo-600" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}