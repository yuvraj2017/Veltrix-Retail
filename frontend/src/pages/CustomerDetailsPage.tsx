import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  SquarePen,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { CustomerFormModal } from '../components/customers/CustomerFormModal'
import { getCustomerAnalytics, updateCustomer } from '../features/customers/api'
import type {
  CustomerAnalyticsDetail,
  CustomerPayload,
  CustomerRecord,
  CustomerStatus,
} from '../features/customers/types'
import { getApiErrorMessage } from '../lib/api-error'

const statusClassNames: Record<CustomerStatus, string> = {
  VIP: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatNumber(value: string | number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function toCustomerRecord(customer: CustomerAnalyticsDetail): CustomerRecord {
  return {
    id: customer.customer_id,
    shop_id: 0,
    first_name: customer.first_name,
    last_name: customer.last_name || null,
    full_name: customer.full_name,
    phone: customer.phone,
    email: customer.email || null,
    address: customer.address || null,
    city: customer.city || null,
    state: customer.state || null,
    pincode: customer.pincode || null,
    gst_number: customer.gst_number || null,
    total_orders: customer.total_orders,
    total_spent: customer.total_spent,
    created_at: '',
    updated_at: '',
  }
}

export function CustomerDetailsPage() {
  const { customerId } = useParams()
  const [customer, setCustomer] = useState<CustomerAnalyticsDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  const editableCustomer = useMemo(
    () => (customer ? toCustomerRecord(customer) : null),
    [customer],
  )

  const loadCustomer = async () => {
    if (!customerId) return

    try {
      setIsLoading(true)
      setErrorMessage('')
      const response = await getCustomerAnalytics(Number(customerId))
      setCustomer(response)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Unable to load customer details'))
      setCustomer(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCustomer()
  }, [customerId])

  const handleUpdateCustomer = async (payload: CustomerPayload) => {
    if (!customer) return

    try {
      setFormLoading(true)
      await updateCustomer(customer.customer_id, payload)
      setFormOpen(false)
      await loadCustomer()
    } finally {
      setFormLoading(false)
    }
  }

  if (isLoading) {
    return (
        <div className="rounded-[2rem] border border-white/60 bg-white px-6 py-16 text-center text-sm font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Loading customer details...
        </div>
    )
  }

  if (!customer) {
    return (
        <div className="rounded-[2rem] border border-red-100 bg-red-50 px-6 py-16 text-center text-sm font-bold text-red-600 shadow-sm dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          {errorMessage || 'Customer not found.'}
        </div>
    )
  }

  const spendMax = Math.max(...customer.spend_trend.map((point) => Number(point.total_spend || 0)), 1)

  return (
    <>
      <div className="mx-auto w-full max-w-[1600px] space-y-8 px-1 py-2 sm:px-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/customers"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <ArrowLeft size={16} />
            Back to Customers
          </Link>

          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(15,23,42,0.18)] transition hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            <SquarePen size={16} />
            Edit Customer
          </button>
        </div>

        <section className="rounded-[2.25rem] bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_28%),linear-gradient(135deg,_#ffffff_0%,_#eef2ff_48%,_#f8fafc_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_28%),linear-gradient(135deg,_#0f172a_0%,_#172554_55%,_#1e293b_100%)] sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600 shadow-sm dark:bg-slate-900/70 dark:text-indigo-300">
                <ReceiptText size={14} />
                Customer Analytics
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-5xl">
                {customer.full_name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <StatusPill status={customer.status} />
                <span className="rounded-full bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-900/70 dark:text-slate-300">
                  Customer since {formatDate(customer.first_invoice_date)}
                </span>
              </div>
              <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                Manage identity, monitor payment health, and review billing history from one place.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[380px]">
              <ContactTile icon={<Phone size={16} />} label="Phone" value={customer.phone} />
              <ContactTile icon={<Mail size={16} />} label="Email" value={customer.email || 'Not saved'} />
              <ContactTile
                icon={<MapPin size={16} />}
                label="Location"
                value={[customer.city, customer.state].filter(Boolean).join(', ') || 'Not saved'}
              />
              <ContactTile
                icon={<Wallet size={16} />}
                label="Outstanding"
                value={formatCurrency(customer.outstanding_amount)}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total Bills" value={formatNumber(customer.total_orders)} icon={<ReceiptText size={18} />} />
          <MetricCard title="Total Revenue" value={formatCurrency(customer.total_spent)} icon={<Wallet size={18} />} />
          <MetricCard title="Outstanding" value={formatCurrency(customer.outstanding_amount)} icon={<TrendingUp size={18} />} />
          <MetricCard title="Total Profit" value={formatCurrency(customer.total_profit)} icon={<TrendingUp size={18} />} />
        </section>
        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/60 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 sm:p-7">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Spend Trend</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">Customer spend vs collections</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Review recent monthly billing value against actual collections.</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              {customer.spend_trend.map((point) => {
                const spendHeight = Math.max((Number(point.total_spend || 0) / spendMax) * 170, 10)
                const collectedHeight = Math.max((Number(point.collected_amount || 0) / spendMax) * 170, 10)

                return (
                  <div key={point.label} className="rounded-[1.4rem] bg-slate-50/80 p-4 dark:bg-slate-800/70">
                    <div className="flex h-[190px] items-end justify-center gap-3">
                      <div className="w-8 rounded-t-2xl bg-gradient-to-t from-indigo-600 to-indigo-300" style={{ height: `${spendHeight}px` }} />
                      <div className="w-8 rounded-t-2xl bg-gradient-to-t from-emerald-600 to-emerald-300" style={{ height: `${collectedHeight}px` }} />
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-sm font-black text-slate-950 dark:text-white">{point.label}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatCurrency(point.total_spend)}</p>
                      <p className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">{formatCurrency(point.collected_amount)} paid</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/60 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 sm:p-7">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Profile Snapshot</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">Customer profile and billing metadata</h2>

            <div className="mt-6 space-y-4 text-sm font-medium text-slate-600 dark:text-slate-300">
              <ProfileRow label="Average Order Value" value={formatCurrency(customer.average_order_value)} />
              <ProfileRow label="Last Invoice" value={formatDate(customer.last_invoice_date)} />
              <ProfileRow label="GST Number" value={customer.gst_number || 'Not saved'} />
              <ProfileRow
                label="Address"
                value={
                  [customer.address, customer.city, customer.state, customer.pincode]
                    .filter(Boolean)
                    .join(', ') || 'Not saved'
                }
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Invoice History</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Every saved invoice linked to this customer.</p>
              </div>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    {['Invoice', 'Date', 'Final Amount', 'Paid', 'Balance', 'Status'].map((label) => (
                      <th key={label} className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customer.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                        No invoice history found.
                      </td>
                    </tr>
                  ) : (
                    customer.invoices.map((invoice) => (
                      <tr key={invoice.invoice_id} className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/50">
                        <td className="px-6 py-5">
                          <Link to={`/billing/${invoice.invoice_id}/preview`} className="font-black text-slate-950 hover:text-indigo-700 dark:text-white dark:hover:text-indigo-300">
                            {invoice.invoice_number}
                          </Link>
                        </td>
                        <td className="px-6 py-5 text-sm font-medium text-slate-600 dark:text-slate-300">{formatDate(invoice.invoice_date)}</td>
                        <td className="px-6 py-5 text-sm font-black text-slate-950 dark:text-white">{formatCurrency(invoice.final_amount)}</td>
                        <td className="px-6 py-5 text-sm font-black text-emerald-600 dark:text-emerald-300">{formatCurrency(invoice.paid_amount)}</td>
                        <td className="px-6 py-5 text-sm font-black text-amber-700 dark:text-amber-300">{formatCurrency(invoice.remaining_amount)}</td>
                        <td className="px-6 py-5"><PaymentPill status={invoice.payment_status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 lg:hidden sm:p-6">
              {customer.invoices.length === 0 ? (
                <MobileStateCard message="No invoice history found." />
              ) : (
                customer.invoices.map((invoice) => (
                  <div key={invoice.invoice_id} className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link to={`/billing/${invoice.invoice_id}/preview`} className="font-black text-slate-950 hover:text-indigo-700 dark:text-white dark:hover:text-indigo-300">
                          {invoice.invoice_number}
                        </Link>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(invoice.invoice_date)}</p>
                      </div>
                      <PaymentPill status={invoice.payment_status} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <MiniValue label="Final" value={formatCurrency(invoice.final_amount)} />
                      <MiniValue label="Paid" value={formatCurrency(invoice.paid_amount)} />
                      <MiniValue label="Balance" value={formatCurrency(invoice.remaining_amount)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Products Purchased</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Top products this customer has purchased through invoices.</p>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[720px]">
                <thead className="bg-slate-50 dark:bg-slate-800/70">
                  <tr>
                    {['Product', 'Category', 'Quantity', 'Sales', 'Profit'].map((label) => (
                      <th key={label} className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customer.products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
                        No purchased products found.
                      </td>
                    </tr>
                  ) : (
                    customer.products.map((product) => (
                      <tr key={`${product.product_id}-${product.product_name}`} className="border-t border-slate-100 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/50">
                        <td className="px-6 py-5">
                          <p className="font-black text-slate-950 dark:text-white">{product.product_name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{product.product_code || 'No code'}</p>
                        </td>
                        <td className="px-6 py-5 text-sm font-medium text-slate-600 dark:text-slate-300">{product.category || '-'}</td>
                        <td className="px-6 py-5 text-sm font-black text-slate-950 dark:text-white">{formatNumber(product.total_quantity)}</td>
                        <td className="px-6 py-5 text-sm font-black text-slate-950 dark:text-white">{formatCurrency(product.total_sales)}</td>
                        <td className="px-6 py-5 text-sm font-black text-emerald-600 dark:text-emerald-300">{formatCurrency(product.total_profit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 lg:hidden sm:p-6">
              {customer.products.length === 0 ? (
                <MobileStateCard message="No purchased products found." />
              ) : (
                customer.products.map((product) => (
                  <div key={`${product.product_id}-${product.product_name}`} className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950 dark:text-white">{product.product_name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{product.category || '-'} {product.product_code ? `· ${product.product_code}` : ''}</p>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        {formatNumber(product.total_quantity)} qty
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniValue label="Sales" value={formatCurrency(product.total_sales)} />
                      <MiniValue label="Profit" value={formatCurrency(product.total_profit)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <CustomerFormModal
        open={formOpen}
        mode="edit"
        customer={editableCustomer}
        loading={formLoading}
        onClose={() => setFormOpen(false)}
        onSubmit={handleUpdateCustomer}
      />
    </>
  )
}

function ContactTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[1.8rem] border border-white/60 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
          {icon}
        </div>
      </div>
    </div>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.3rem] bg-slate-50 px-4 py-4 dark:bg-slate-800/70">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

function StatusPill({ status }: { status: CustomerStatus }) {
  return (
    <span className={['inline-flex rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] ring-1', statusClassNames[status]].join(' ')}>
      {status}
    </span>
  )
}

function PaymentPill({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase()
  const className =
    normalizedStatus === 'paid'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900'
      : normalizedStatus === 'partial'
        ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900'
        : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'

  return (
    <span className={['inline-flex rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] ring-1', className].join(' ')}>
      {status}
    </span>
  )
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] bg-white px-3 py-3 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  )
}

function MobileStateCard({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
      {message}
    </div>
  )
}









