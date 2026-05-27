import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  Share2,
  Sparkles,
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
  onEdit: (invoiceId: number) => void
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
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase ${item.className}`}>
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
    { label: 'All Invoices', value: 'all' as const, helper: 'Every payment status', icon: FileText },
    { label: 'Paid', value: 'paid' as const, helper: 'Completed payments', icon: CheckCircle2 },
    { label: 'Pending', value: 'pending' as const, helper: 'Awaiting payment', icon: Clock3 },
    { label: 'Partial', value: 'partial' as const, helper: 'Partially paid', icon: Sparkles },
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
          className={`text-slate-500 transition-transform duration-300 ${open ? 'rotate-180 text-indigo-600' : ''}`}
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

// ─── Portal dropdown for InvoiceActions ───────────────────────────────────────
// Renders the dropdown via a React portal so it escapes any parent
// overflow:hidden containers and always positions correctly on screen.

type DropdownPosition = {
  top: number
  right: number
  openUpward: boolean
}

function InvoiceActionsDropdown({
  position,
  actions,
  onClose,
}: {
  position: DropdownPosition
  actions: { label: string; icon: React.ElementType; onClick: () => void }[]
  onClose: () => void
}) {
  const dropdownStyle: React.CSSProperties = position.openUpward
    ? {
        position: 'fixed',
        bottom: window.innerHeight - position.top + 8,
        right: window.innerWidth - position.right,
        zIndex: 99999,
      }
    : {
        position: 'fixed',
        top: position.top + 8,
        right: window.innerWidth - position.right,
        zIndex: 99999,
      }

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: position.openUpward ? 8 : -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={dropdownStyle}
      className="w-[250px] overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-2xl"
    >
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
          Actions
        </p>
      </div>

      <div className="space-y-1 p-2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
                action.onClick()
              }}
              className="group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200 hover:bg-indigo-50"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-all duration-200 group-hover:bg-indigo-100 group-hover:text-indigo-600">
                <Icon size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-bold text-slate-700">
                  {action.label}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </motion.div>,
    document.body,
  )
}

function InvoiceActions({
  invoiceId,
  onView,
  onEdit,
  onPrint,
  onDownload,
  onShare,
}: {
  invoiceId: number
  onView: (invoiceId: number) => void
  onEdit: (invoiceId: number) => void
  onPrint: (invoiceId: number) => void
  onDownload: (invoiceId: number) => void
  onShare: (invoiceId: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<DropdownPosition | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const actions = [
    { label: 'View Invoice', icon: Eye, onClick: () => onView(invoiceId) },
    { label: 'Edit Invoice', icon: Pencil, onClick: () => onEdit(invoiceId) },
    { label: 'Print Invoice', icon: Printer, onClick: () => onPrint(invoiceId) },
    { label: 'Download PDF', icon: Download, onClick: () => onDownload(invoiceId) },
    { label: 'Share Invoice', icon: Share2, onClick: () => onShare(invoiceId) },
  ]

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    if (open) {
      setOpen(false)
      return
    }

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      // Estimated dropdown height: header (~60px) + 5 items × ~62px = ~370px
      const estimatedHeight = 370

      setPosition({
        top: rect.bottom,
        right: rect.right,
        openUpward: spaceBelow < estimatedHeight,
      })
    }

    setOpen(true)
  }, [open])

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return

    const handleClose = () => setOpen(false)
    document.addEventListener('mousedown', handleClose)
    document.addEventListener('scroll', handleClose, true)
    return () => {
      document.removeEventListener('mousedown', handleClose)
      document.removeEventListener('scroll', handleClose, true)
    }
  }, [open])

  return (
    // Stop propagation on the wrapper so row's onClick doesn't fire
    <div
      className="relative flex items-center justify-end"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={`group flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-300 ${
          open
            ? 'border-indigo-200 bg-indigo-50 text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.20)]'
            : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600'
        }`}
      >
        <MoreVertical
          size={18}
          className={`transition-transform duration-300 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && position && (
        <InvoiceActionsDropdown
          position={position}
          actions={actions}
          onClose={() => setOpen(false)}
        />
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
  onEdit,
  onCreate,
  onPrint,
  onDownload,
  onShare,
}: InvoiceTableProps) {
  return (
    <section className="overflow-hidden rounded-[34px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
      {/* Header */}
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

      {/* Table header */}
      <div className="hidden grid-cols-[1.05fr_1fr_1.2fr_1fr_1fr_0.85fr_0.55fr] px-8 py-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 lg:grid">
        <div>Invoice #</div>
        <div>Date</div>
        <div>Customer</div>
        <div>Contact</div>
        <div>Amount</div>
        <div>Status</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Body */}
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
        // ⚠️  overflow-x-auto here so wide rows scroll horizontally on small
        //     screens, but we do NOT use overflow-hidden so portal dropdowns
        //     are never clipped.
        <div className="overflow-x-auto px-4 pb-4">
          {invoices.map((invoice, index) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035, duration: 0.32 }}
              onClick={() => onView(invoice.id)}
              className="group grid min-w-[1100px] cursor-pointer grid-cols-[1.05fr_1fr_1.2fr_1fr_1fr_0.85fr_0.55fr] items-center gap-4 rounded-[26px] px-4 py-5 text-left transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50 hover:shadow-[0_18px_42px_rgba(15,23,42,0.05)] lg:px-5"
            >
              {/* Invoice # */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] transition duration-300 group-hover:scale-105 group-hover:from-indigo-500 group-hover:to-violet-600 group-hover:text-white">
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

              {/* Date */}
              <div className="text-[15px] font-semibold text-slate-700">
                {formatDate(invoice.invoice_date)}
              </div>

              {/* Customer */}
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

              {/* Contact */}
              <div className="inline-flex items-center gap-2 text-[15px] font-medium text-slate-600">
                <Phone size={15} className="text-slate-400" />
                {invoice.customer_phone_snapshot || '—'}
              </div>

              {/* Amount */}
              <div>
                <p className="text-lg font-black tracking-[-0.02em] text-slate-950">
                  {money(invoice.final_amount)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Discount {money(invoice.total_discount_amount)}
                </p>
              </div>

              {/* Status */}
              <div>
                <PaymentStatusBadge status={invoice.payment_status} />
              </div>

              {/* Actions */}
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
                  onEdit={onEdit}
                  onPrint={onPrint}
                  onDownload={onDownload}
                  onShare={onShare}
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && invoices.length > 0 && (
        <div className="flex flex-col gap-4 px-8 py-6 text-[14px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing{' '}
            <span className="font-black text-slate-950">1–{invoices.length}</span> of{' '}
            <span className="font-black text-slate-950">{totalInvoices}</span> invoices
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