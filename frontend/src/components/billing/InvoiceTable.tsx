import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileText,
  MoreVertical,
  Pencil,
  Phone,
  Printer,
  ReceiptText,
  Search,
  Send,
  Share2,
  Sparkles,
  XCircle,
} from 'lucide-react'

import type { InvoiceListItem, PaymentStatus } from '../../features/billing/types'

type InvoiceTableProps = {
  invoices: InvoiceListItem[]
  totalInvoices: number
  isLoading: boolean
  search: string
  onSearchChange: (value: string) => void
  paymentStatus: 'all' | PaymentStatus
  onPaymentStatusChange: (value: 'all' | PaymentStatus) => void
  onView: (invoiceId: number) => void
  onCreate: () => void
  onPrint: (invoiceId: number) => void
  onDownload: (invoiceId: number) => void
  onShare: (invoiceId: number) => void
}

const money = (value: string | number) => {
  const amount = Number(value || 0)

  return amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

const formatDate = (value: string) => {
  if (!value) return '—'

  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getInitials = (name: string) => {
  const parts = name.trim().split(' ').filter(Boolean)

  if (parts.length === 0) return 'C'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = {
    paid: {
      label: 'Paid',
      className: 'bg-emerald-50 text-emerald-700',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
    },
    pending: {
      label: 'Pending',
      className: 'bg-orange-50 text-orange-700',
      dot: 'bg-orange-500',
      icon: Clock3,
    },
    partial: {
      label: 'Partial',
      className: 'bg-indigo-50 text-indigo-700',
      dot: 'bg-indigo-500',
      icon: Sparkles,
    },
  }

  const item = config[status]
  const Icon = item.icon

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase ${item.className}`}
    >
      <span className={`h-2 w-2 rounded-full ${item.dot}`} />
      <Icon size={13} />
      {item.label}
    </span>
  )
}

function PaymentFilterDropdown({
  value,
  onChange,
}: {
  value: 'all' | PaymentStatus
  onChange: (value: 'all' | PaymentStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const options = [
    {
      label: 'All Invoices',
      value: 'all' as const,
      helper: 'Every payment status',
      icon: FileText,
    },
    {
      label: 'Paid',
      value: 'paid' as const,
      helper: 'Completed payments',
      icon: CheckCircle2,
    },
    {
      label: 'Pending',
      value: 'pending' as const,
      helper: 'Awaiting payment',
      icon: Clock3,
    },
    {
      label: 'Partial',
      value: 'partial' as const,
      helper: 'Partially paid',
      icon: Sparkles,
    },
  ]

  const selected = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`group flex h-14 min-w-[210px] items-center justify-between gap-4 rounded-[22px] border px-5 text-[15px] font-semibold outline-none transition-all duration-300 ${
          open
            ? 'border-indigo-300 bg-white shadow-[0_18px_42px_rgba(79,70,229,0.14)]'
            : 'border-indigo-100/80 bg-slate-50/90 shadow-[0_10px_28px_rgba(15,23,42,0.04)] hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_16px_38px_rgba(79,70,229,0.10)]'
        }`}
      >
        <span className="flex items-center gap-3 text-slate-700">
          <selected.icon size={18} className="text-indigo-600" />
          {selected.label}
        </span>

        <ChevronDown
          size={18}
          className={`text-slate-500 transition-transform duration-300 ${
            open ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="absolute right-0 z-30 mt-3 w-[260px] overflow-hidden rounded-[24px] border border-white/70 bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl"
        >
          {options.map((option) => {
            const Icon = option.icon
            const active = value === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    active
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon size={18} />
                </div>

                <div>
                  <p className="text-sm font-black">{option.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{option.helper}</p>
                </div>
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

function InvoiceActions({
  invoiceId,
  onView,
  onPrint,
  onDownload,
  onShare,
}: {
  invoiceId: number
  onView: (invoiceId: number) => void
  onPrint: (invoiceId: number) => void
  onDownload: (invoiceId: number) => void
  onShare: (invoiceId: number) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const actions = [
    { label: 'View', icon: Eye, onClick: () => onView(invoiceId) },
    { label: 'Edit', icon: Pencil, onClick: () => onView(invoiceId) },
    { label: 'Print', icon: Printer, onClick: () => onPrint(invoiceId) },
    { label: 'Download', icon: Download, onClick: () => onDownload(invoiceId) },
    { label: 'Share', icon: Share2, onClick: () => onShare(invoiceId) },
  ]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative flex justify-end">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition duration-300 hover:bg-indigo-600 hover:text-white"
      >
        <MoreVertical size={18} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="absolute right-0 top-12 z-30 w-[190px] overflow-hidden rounded-[22px] border border-white/70 bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl"
        >
          {actions.map((action) => {
            const Icon = action.icon

            return (
              <button
                key={action.label}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setOpen(false)
                  action.onClick()
                }}
                className="flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Icon size={16} />
                {action.label}
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default function InvoiceTable({
  invoices,
  totalInvoices,
  isLoading,
  search,
  onSearchChange,
  paymentStatus,
  onPaymentStatusChange,
  onView,
  onCreate,
  onPrint,
  onDownload,
  onShare,
}: InvoiceTableProps) {
  return (
    <section className="overflow-hidden rounded-[34px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-5 px-6 pb-7 pt-7 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-[-0.035em] text-slate-950">
            Recent Invoice Activity
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Search, filter, and manage saved invoices.
          </p>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative w-full xl:w-[420px]">
            <Search
              size={19}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search invoice, customer, phone..."
              className="h-14 w-full rounded-[22px] border border-indigo-100/70 bg-slate-50/90 pl-14 pr-5 text-[15px] font-medium text-slate-700 outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
            />
          </div>

          <PaymentFilterDropdown
            value={paymentStatus}
            onChange={onPaymentStatusChange}
          />

          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            onClick={onCreate}
            className="group inline-flex h-14 items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-6 text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.30)] transition-all duration-300 hover:shadow-[0_24px_54px_rgba(79,70,229,0.38)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/16 transition-transform duration-300 group-hover:rotate-90">
              +
            </span>
            Create Invoice
          </motion.button>
        </div>
      </div>

      <div className="hidden grid-cols-[1.05fr_1fr_1.2fr_1fr_1fr_0.85fr_0.55fr] px-8 py-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 lg:grid">
        <div>Invoice #</div>
        <div>Date</div>
        <div>Customer</div>
        <div>Contact</div>
        <div>Amount</div>
        <div>Status</div>
        <div className="text-right">Actions</div>
      </div>

      {isLoading ? (
        <div className="space-y-4 px-6 pb-8">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-[96px] animate-pulse rounded-[26px] bg-slate-50"
            />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)]">
            <ReceiptText size={34} />
          </div>

          <h3 className="text-2xl font-black tracking-[-0.03em] text-slate-950">
            No invoices found
          </h3>

          <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
            Create your first invoice or adjust your search/filter to see matching billing records.
          </p>

          <button
            type="button"
            onClick={onCreate}
            className="mt-7 rounded-[20px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-6 py-3 text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.26)] transition hover:-translate-y-[1px]"
          >
            Create Invoice
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4">
          {invoices.map((invoice, index) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035, duration: 0.32 }}
              onClick={() => onView(invoice.id)}
              className="group grid cursor-pointer grid-cols-1 items-center gap-4 rounded-[26px] px-4 py-5 text-left transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 hover:shadow-[0_18px_42px_rgba(15,23,42,0.05)] lg:grid-cols-[1.05fr_1fr_1.2fr_1fr_1fr_0.85fr_0.55fr] lg:px-5"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] transition duration-300 group-hover:scale-105 group-hover:bg-gradient-to-br group-hover:from-indigo-500 group-hover:to-violet-600 group-hover:text-white">
                  <FileText size={24} />
                </div>

                <div>
                  <h4 className="text-base font-black tracking-[-0.01em] text-indigo-700">
                    #{invoice.invoice_number}
                  </h4>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {invoice.invoice_status}
                  </p>
                </div>
              </div>

              <div className="text-[15px] font-semibold text-slate-700">
                {formatDate(invoice.invoice_date)}
              </div>

              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600">
                  {getInitials(invoice.customer_name_snapshot)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[15px] font-black text-slate-950">
                    {invoice.customer_name_snapshot}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                    Customer snapshot
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-[15px] font-medium text-slate-600">
                <Phone size={15} className="text-slate-400" />
                {invoice.customer_phone_snapshot || '—'}
              </div>

              <div>
                <p className="text-lg font-black tracking-[-0.02em] text-slate-950">
                  {money(invoice.final_amount)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Discount {money(invoice.total_discount_amount)}
                </p>
              </div>

              <div>
                <PaymentStatusBadge status={invoice.payment_status} />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onView(invoice.id)
                  }}
                  className="hidden h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition duration-300 hover:bg-indigo-600 hover:text-white xl:flex"
                >
                  <ArrowRight size={18} />
                </button>

                <InvoiceActions
                  invoiceId={invoice.id}
                  onView={onView}
                  onPrint={onPrint}
                  onDownload={onDownload}
                  onShare={onShare}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && invoices.length > 0 && (
        <div className="flex flex-col gap-4 px-8 py-6 text-[14px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing{' '}
            <span className="font-black text-slate-950">
              1-{invoices.length}
            </span>{' '}
            of{' '}
            <span className="font-black text-slate-950">
              {totalInvoices}
            </span>{' '}
            invoices
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-xl px-4 py-2 font-semibold transition hover:bg-slate-100">
              Previous
            </button>
            <button className="rounded-xl px-4 py-2 font-semibold transition hover:bg-slate-100">
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}