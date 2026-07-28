import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Crown,
  Plus,
  RefreshCcw,
  Search,
  SquarePen,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'

import { CustomerFormModal } from '../components/customers/CustomerFormModal'
import { AppShell } from '../components/layout/AppShell'
import {
  createCustomer,
  getCustomerById,
  getCustomerCharts,
  getCustomerInsights,
  getCustomers,
  getCustomerSummary,
  updateCustomer,
} from '../features/customers/api'
import type {
  CustomerCharts,
  CustomerDirectoryItem,
  CustomerInsight,
  CustomerPayload,
  CustomerRecord,
  CustomerStatus,
  CustomerSummary,
  CustomerTopCustomerItem,
} from '../features/customers/types'
import { getApiErrorMessage } from '../lib/api-error'

const PAGE_SIZE = 12

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'VIP', label: 'VIP' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
]

const sortOptions = [
  { value: 'recent', label: 'Recently billed' },
  { value: 'spent_desc', label: 'Highest spending' },
  { value: 'orders_desc', label: 'Most orders' },
  { value: 'outstanding_desc', label: 'Highest outstanding' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
]

const statusClassNames: Record<CustomerStatus, string> = {
  VIP: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
}

const statusDotClassNames: Record<CustomerStatus, string> = {
  VIP: 'bg-amber-500',
  ACTIVE: 'bg-emerald-500',
  INACTIVE: 'bg-slate-400',
}

const statusBarClassNames: Record<CustomerStatus, string> = {
  VIP: 'from-amber-400 to-orange-500',
  ACTIVE: 'from-emerald-400 to-teal-500',
  INACTIVE: 'from-slate-400 to-slate-500',
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatCompactCurrency(value: string | number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(Number(value || 0))
}

function formatNumber(value: string | number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatPercent(value: string | number) {
  return `${Number(value || 0).toFixed(0)}%`
}

function formatDate(value?: string | null) {
  if (!value) return 'No bills yet'

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

export function CustomersPage() {
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [charts, setCharts] = useState<CustomerCharts | null>(null)
  const [insights, setInsights] = useState<CustomerInsight | null>(null)
  const [customers, setCustomers] = useState<CustomerDirectoryItem[]>([])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [isDirectoryLoading, setIsDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState('')
  const [portfolioError, setPortfolioError] = useState('')

  const [refreshKey, setRefreshKey] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [actionCustomerId, setActionCustomerId] = useState<number | null>(null)

  const totalPages = useMemo(() => Math.max(Math.ceil(total / PAGE_SIZE), 1), [total])

  const showingText = useMemo(() => {
    if (total === 0) return 'No customers found'
    const start = (page - 1) * PAGE_SIZE + 1
    const end = Math.min(page * PAGE_SIZE, total)
    return `Showing ${start}-${end} of ${total} customers`
  }, [page, total])

  const fetchPortfolio = async () => {
    try {
      setPortfolioError('')
      const [summaryData, chartsData, insightData] = await Promise.all([
        getCustomerSummary(),
        getCustomerCharts(6),
        getCustomerInsights(),
      ])
      setSummary(summaryData)
      setCharts(chartsData)
      setInsights(insightData)
    } catch (error) {
      setPortfolioError(getApiErrorMessage(error, 'Unable to load customer insights'))
    }
  }

  const fetchDirectory = async (
    nextSearch: string,
    nextStatus: string,
    nextSortBy: string,
    nextPage: number,
  ) => {
    try {
      setIsDirectoryLoading(true)
      setDirectoryError('')
      const response = await getCustomers({
        search: nextSearch || undefined,
        status: nextStatus || undefined,
        sort_by: nextSortBy || undefined,
        page: nextPage,
        page_size: PAGE_SIZE,
      })
      setCustomers(response.items)
      setTotal(response.total)
    } catch (error) {
      setCustomers([])
      setTotal(0)
      setDirectoryError(getApiErrorMessage(error, 'Unable to load customer directory'))
    } finally {
      setIsDirectoryLoading(false)
    }
  }

  useEffect(() => {
    fetchPortfolio()
  }, [refreshKey])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchDirectory(search, statusFilter, sortBy, page)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [search, statusFilter, sortBy, page, refreshKey])

  const openCreateModal = () => {
    setFormMode('create')
    setSelectedCustomer(null)
    setFormOpen(true)
  }

  const openEditModal = async (customerId: number) => {
    try {
      setActionCustomerId(customerId)
      const customer = await getCustomerById(customerId)
      setSelectedCustomer(customer)
      setFormMode('edit')
      setFormOpen(true)
    } catch (error) {
      setDirectoryError(getApiErrorMessage(error, 'Unable to load customer details'))
    } finally {
      setActionCustomerId(null)
    }
  }

  const handleFormSubmit = async (payload: CustomerPayload) => {
    try {
      setFormLoading(true)

      if (formMode === 'create') {
        await createCustomer(payload)
      } else if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, payload)
      }

      setFormOpen(false)
      setSelectedCustomer(null)
      setRefreshKey((current) => current + 1)
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1600px] space-y-8 px-1 py-2 sm:px-2">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-indigo-100/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96),_transparent_30%),linear-gradient(135deg,_#eef2ff_0%,_#dbeafe_42%,_#c7d2fe_100%)] px-6 py-8 text-slate-950 shadow-[0_24px_70px_rgba(99,102,241,0.16)] dark:border-indigo-900/60 dark:bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.24),_transparent_28%),linear-gradient(135deg,_#172554_0%,_#312e81_54%,_#1d4ed8_100%)] dark:text-white sm:px-8 lg:px-10">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-indigo-200/60 blur-3xl dark:bg-white/10" />
          <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-blue-300/60 blur-3xl dark:bg-cyan-400/20" />

          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/82 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-sm dark:border-white/15 dark:bg-white/10 dark:text-indigo-100">
                <Users size={14} />
                Customer Management
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Manage billed customers and track who is coming back.
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base dark:text-indigo-100/85">
                Search every customer record tied to invoices, identify high-value accounts,
                and act on inactive or pending-balance customers from one responsive workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
              <HeroMetric
                label="Repeat Rate"
                value={formatPercent(summary?.repeat_customer_rate || 0)}
                hint="repeat buyers"
              />
              <HeroMetric
                label="VIP Accounts"
                value={formatNumber(summary?.vip_customers || 0)}
                hint="high value"
              />
              <HeroMetric
                label="Outstanding"
                value={formatCompactCurrency(summary?.outstanding_amount || 0)}
                hint="receivables"
              />
            </div>
          </div>
        </section>

        {portfolioError ? (
          <div className="rounded-[1.75rem] border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            {portfolioError}
          </div>
        ) : null}

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Customers"
            value={formatNumber(summary?.total_customers || 0)}
            hint={`${formatNumber(summary?.billed_customers || 0)} billed so far`}
            icon={<Users size={20} />}
            highlight
          />
          <StatCard
            title="Active Customers"
            value={formatNumber(summary?.active_customers || 0)}
            hint={`${formatNumber(summary?.inactive_customers || 0)} inactive`}
            icon={<TrendingUp size={20} />}
          />
          <StatCard
            title="Customer Revenue"
            value={formatCompactCurrency(summary?.total_revenue || 0)}
            hint={`${formatCompactCurrency(summary?.average_lifetime_value || 0)} avg LTV`}
            icon={<Wallet size={20} />}
          />
          <StatCard
            title="Repeat Rate"
            value={formatPercent(summary?.repeat_customer_rate || 0)}
            hint="customers with more than one order"
            icon={<Crown size={20} />}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <RevenueTrendCard points={charts?.revenue_trend || []} />
          <GrowthCard points={charts?.customer_growth || []} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <StatusBreakdownCard
            items={charts?.status_breakdown || []}
            insightMessage={
              insights?.retention_message ||
              'Retention insights will appear here once invoices accumulate.'
            }
          />
          <TopCustomersCard
            customers={charts?.top_customers || insights?.top_customers || []}
          />
        </section>

        <section className="rounded-[2rem] border border-indigo-100/80 bg-[linear-gradient(135deg,_rgba(238,242,255,0.96)_0%,_rgba(255,255,255,0.98)_46%,_rgba(224,231,255,0.88)_100%)] p-4 shadow-[0_18px_44px_rgba(99,102,241,0.12)] dark:border-indigo-900/60 dark:bg-[linear-gradient(135deg,_rgba(30,41,59,0.95)_0%,_rgba(15,23,42,0.96)_50%,_rgba(49,46,129,0.52)_100%)] sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-300">
                  Directory Filters
                </p>
                <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                  Search and refine customers comfortably
                </h2>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.42fr)_minmax(240px,0.48fr)]">
                <div className="relative">
                  <Search size={18} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400 dark:text-indigo-300" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Search customer name, phone, email, city..."
                    className="h-14 w-full rounded-[1.5rem] border border-indigo-100 bg-white/92 pl-12 pr-4 text-sm font-medium text-slate-700 shadow-[0_14px_30px_rgba(99,102,241,0.10)] outline-none transition focus:-translate-y-[1px] focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-950"
                  />
                </div>

                <FilterMenu
                  label="Customer status"
                  value={statusFilter}
                  onChange={(nextValue) => {
                    setStatusFilter(nextValue)
                    setPage(1)
                  }}
                  options={statusOptions}
                />

                <FilterMenu
                  label="Sort directory"
                  value={sortBy}
                  onChange={(nextValue) => {
                    setSortBy(nextValue)
                    setPage(1)
                  }}
                  options={sortOptions}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <button
                type="button"
                onClick={() => setRefreshKey((current) => current + 1)}
                className="inline-flex h-14 items-center gap-2 rounded-[1.45rem] border border-indigo-200 bg-white/92 px-5 text-sm font-bold text-slate-700 shadow-[0_12px_24px_rgba(99,102,241,0.10)] transition hover:-translate-y-[1px] hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:border-indigo-500"
              >
                <RefreshCcw size={16} />
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-14 items-center gap-2 rounded-[1.45rem] bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 px-5 text-sm font-black text-white shadow-[0_18px_34px_rgba(79,70,229,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_24px_44px_rgba(79,70,229,0.32)] dark:from-indigo-500 dark:via-indigo-400 dark:to-blue-400"
              >
                <UserPlus size={16} />
                Add Customer
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                Customer Directory
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {showingText}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Plus size={14} />
              Responsive Directory View
            </div>
          </div>

          {directoryError ? (
            <div className="px-6 py-6 text-sm font-semibold text-red-600 dark:text-red-400">
              {directoryError}
            </div>
          ) : null}

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px]">
              <thead className="bg-slate-50 dark:bg-slate-800/70">
                <tr>
                  {[
                    'Customer',
                    'Status',
                    'Location',
                    'Orders',
                    'Revenue',
                    'Outstanding',
                    'Last Bill',
                    'Actions',
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isDirectoryLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                      Loading customer directory...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                      No customers matched the current filters.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.customer_id} className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            {getInitials(customer.full_name)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-950 dark:text-white">{customer.full_name}</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{customer.phone}</p>
                            <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">{customer.email || 'No email saved'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <StatusPill status={customer.status} />
                      </td>
                      <td className="px-6 py-5 text-sm font-medium text-slate-600 dark:text-slate-300">
                        {[customer.city, customer.state].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-slate-950 dark:text-white">
                        {formatNumber(customer.total_orders)}
                      </td>
                      <td className="px-6 py-5 text-sm font-black text-slate-950 dark:text-white">
                        {formatCurrency(customer.total_spent)}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-amber-700 dark:text-amber-300">
                        {formatCurrency(customer.outstanding_amount)}
                      </td>
                      <td className="px-6 py-5 text-sm font-medium text-slate-600 dark:text-slate-300">
                        {formatDate(customer.last_invoice_date)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditModal(customer.customer_id)}
                            disabled={actionCustomerId === customer.customer_id}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:text-indigo-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            <SquarePen size={13} />
                            Edit
                          </button>
                          <Link
                            to={`/customers/${customer.customer_id}`}
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_28px_rgba(79,70,229,0.20)] transition hover:-translate-y-[1px] dark:from-indigo-500 dark:via-indigo-400 dark:to-blue-400"
                          >
                            Details
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 p-4 lg:hidden sm:p-6">
            {isDirectoryLoading ? (
              <MobileStateCard message="Loading customer directory..." />
            ) : customers.length === 0 ? (
              <MobileStateCard message="No customers matched the current filters." />
            ) : (
              customers.map((customer) => (
                <div
                  key={customer.customer_id}
                  className="rounded-[1.6rem] border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {getInitials(customer.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950 dark:text-white">{customer.full_name}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{customer.phone}</p>
                        </div>
                      </div>
                    </div>
                    <StatusPill status={customer.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <DataTile label="Revenue" value={formatCurrency(customer.total_spent)} />
                    <DataTile label="Outstanding" value={formatCurrency(customer.outstanding_amount)} />
                    <DataTile label="Orders" value={formatNumber(customer.total_orders)} />
                    <DataTile label="Last Bill" value={formatDate(customer.last_invoice_date)} />
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => openEditModal(customer.customer_id)}
                      disabled={actionCustomerId === customer.customer_id}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:text-indigo-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <SquarePen size={15} />
                      Edit
                    </button>
                    <Link
                      to={`/customers/${customer.customer_id}`}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 text-sm font-black text-white shadow-[0_14px_28px_rgba(79,70,229,0.20)] transition hover:-translate-y-[1px] dark:from-indigo-500 dark:via-indigo-400 dark:to-blue-400"
                    >
                      View Details
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{showingText}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Previous
              </button>
              <span className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-black text-white">
                {page}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      <CustomerFormModal
        open={formOpen}
        mode={formMode}
        customer={selectedCustomer}
        loading={formLoading}
        onClose={() => {
          setFormOpen(false)
          setSelectedCustomer(null)
        }}
        onSubmit={handleFormSubmit}
      />
    </AppShell>
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
    <div className="rounded-[1.6rem] border border-indigo-100/70 bg-white/72 px-4 py-4 shadow-sm backdrop-blur-sm dark:border-white/15 dark:bg-white/10">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-100/70">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-indigo-100/75">{hint}</p>
    </div>
  )
}

function StatCard({
  title,
  value,
  hint,
  icon,
  highlight = false,
}: {
  title: string
  value: string
  hint: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'rounded-[1.9rem] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]',
        highlight
          ? 'bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-white dark:from-indigo-500 dark:via-indigo-400 dark:to-blue-400'
          : 'border border-white/60 bg-white dark:border-slate-700 dark:bg-slate-900',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${highlight ? 'text-white/60' : 'text-slate-500 dark:text-slate-400'}`}>
            {title}
          </p>
          <p className={`mt-4 text-3xl font-black tracking-tight ${highlight ? 'text-white' : 'text-slate-950 dark:text-white'}`}>
            {value}
          </p>
          <p className={`mt-2 text-sm font-semibold ${highlight ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
            {hint}
          </p>
        </div>

        <div
          className={[
            'flex h-12 w-12 items-center justify-center rounded-2xl',
            highlight
              ? 'bg-white/10 text-white'
              : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
          ].join(' ')}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function RevenueTrendCard({ points }: { points: CustomerCharts['revenue_trend'] }) {
  const maxValue = Math.max(...points.map((point) => Number(point.revenue || 0)), 1)

  return (
    <div className="rounded-[2rem] border border-white/60 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Revenue Trend</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">Customer sales vs collections</h3>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Track how much customers were billed and how much has already been collected.</p>
        </div>
        <div className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Last 6 months</div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {points.map((point) => {
          const revenueHeight = Math.max((Number(point.revenue || 0) / maxValue) * 180, 12)
          const collectionHeight = Math.max((Number(point.collected_amount || 0) / maxValue) * 180, 12)

          return (
            <div key={point.label} className="rounded-[1.5rem] bg-slate-50/80 p-4 dark:bg-slate-800/70">
              <div className="flex h-[210px] items-end justify-center gap-3">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Sales</span>
                  <div className="w-8 rounded-t-2xl bg-gradient-to-t from-indigo-600 to-indigo-300" style={{ height: `${revenueHeight}px` }} />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Paid</span>
                  <div className="w-8 rounded-t-2xl bg-gradient-to-t from-emerald-600 to-emerald-300" style={{ height: `${collectionHeight}px` }} />
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm font-black text-slate-950 dark:text-white">{point.label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatCompactCurrency(point.revenue)}</p>
                <p className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">{formatCompactCurrency(point.collected_amount)} collected</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GrowthCard({ points }: { points: CustomerCharts['customer_growth'] }) {
  const maxValue = Math.max(...points.map((point) => point.new_customers + point.returning_customers), 1)

  return (
    <div className="rounded-[2rem] border border-white/60 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 sm:p-7">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Growth Mix</p>
      <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">New vs returning customers</h3>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">See whether recent billing is driven by new acquisition or repeat business.</p>

      <div className="mt-6 space-y-4">
        {points.map((point) => {
          const total = point.new_customers + point.returning_customers
          const width = Math.max((total / maxValue) * 100, total > 0 ? 18 : 0)
          const newWidth = total > 0 ? (point.new_customers / total) * 100 : 0
          const returningWidth = total > 0 ? 100 - newWidth : 0

          return (
            <div key={point.label}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-sm font-black text-slate-900 dark:text-white">{point.label}</p>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{total} customers</p>
              </div>
              <div className="rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                <div className="flex h-4 overflow-hidden rounded-full" style={{ width: `${width}%` }}>
                  <div className="bg-indigo-500" style={{ width: `${newWidth}%` }} />
                  <div className="bg-emerald-500" style={{ width: `${returningWidth}%` }} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                <span>New {point.new_customers}</span>
                <span>Returning {point.returning_customers}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function StatusBreakdownCard({
  items,
  insightMessage,
}: {
  items: CustomerCharts['status_breakdown']
  insightMessage: string
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="rounded-[2rem] border border-white/60 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Status Breakdown</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">Customer health snapshot</h3>
        </div>
        <div className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{formatNumber(total)} accounts</div>
      </div>

      <div className="mt-6 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="flex h-4 w-full">
          {items.map((item) => {
            const width = total > 0 ? (item.count / total) * 100 : 0
            return (
              <div
                key={item.status}
                className={`bg-gradient-to-r ${statusBarClassNames[item.status]}`}
                style={{ width: `${width}%` }}
              />
            )
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.status} className="rounded-[1.4rem] bg-slate-50 px-4 py-4 dark:bg-slate-800/70">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClassNames[item.status]}`} />
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.status}</span>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{formatNumber(item.count)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[1.6rem] bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 p-5 text-white shadow-[0_16px_32px_rgba(79,70,229,0.24)] dark:from-indigo-500 dark:via-indigo-400 dark:to-blue-400">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">Retention Insight</p>
        <p className="mt-3 text-sm font-medium leading-7 text-white/85">{insightMessage}</p>
      </div>
    </div>
  )
}

function TopCustomersCard({ customers }: { customers: CustomerTopCustomerItem[] }) {
  return (
    <div className="rounded-[2rem] border border-white/60 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 sm:p-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Top Accounts</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">Highest value customers</h3>
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">VIP pipeline</div>
      </div>

      <div className="mt-6 space-y-3">
        {customers.length === 0 ? (
          <div className="rounded-[1.5rem] bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
            No top-customer data is available yet.
          </div>
        ) : (
          customers.map((customer, index) => (
            <div key={customer.customer_id} className="flex flex-col gap-4 rounded-[1.5rem] bg-slate-50 px-4 py-4 dark:bg-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-xs font-black text-white shadow-[0_14px_28px_rgba(79,70,229,0.24)] dark:from-indigo-500 dark:via-indigo-400 dark:to-blue-400">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <Link to={`/customers/${customer.customer_id}`} className="block truncate font-black text-slate-950 hover:text-indigo-700 dark:text-white dark:hover:text-indigo-300">
                      {customer.customer_name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusPill status={customer.status} compact />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {formatNumber(customer.total_orders)} orders
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 sm:justify-end">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Revenue</p>
                  <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">{formatCurrency(customer.total_spent)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Outstanding</p>
                  <p className="mt-1 text-sm font-black text-amber-700 dark:text-amber-300">{formatCurrency(customer.outstanding_amount)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatusPill({ status, compact = false }: { status: CustomerStatus; compact?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full ring-1',
        compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]',
        'font-black uppercase tracking-[0.14em]',
        statusClassNames[status],
      ].join(' ')}
    >
      {status}
    </span>
  )
}


function FilterMenu({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (nextValue: string) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const activeOption = options.find((option) => option.value === value) || options[0]

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-14 w-full items-center justify-between rounded-[1.5rem] border border-indigo-100 bg-white/92 px-4 text-left shadow-[0_14px_28px_rgba(99,102,241,0.10)] transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900/90"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-bold text-slate-700 dark:text-slate-100">
            {activeOption.label}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-500 transition-transform dark:text-slate-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-3 overflow-hidden rounded-[1.45rem] border border-indigo-100 bg-white/96 p-2 shadow-[0_24px_48px_rgba(79,70,229,0.18)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/96">
          <div className="space-y-1">
            {options.map((option) => {
              const active = option.value === value

              return (
                <button
                  key={option.value || option.label}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-[1.05rem] px-3 py-3 text-left text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-[0_10px_24px_rgba(79,70,229,0.24)]'
                      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{option.label}</span>
                  {active ? <Check size={15} className="shrink-0" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DataTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] bg-white px-3 py-3 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}

function MobileStateCard({ message }: { message: string }) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200/80 bg-slate-50/70 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
      {message}
    </div>
  )
}



