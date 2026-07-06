import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertCircle, Download, Filter, ReceiptText,
  CheckCircle2, Clock3, Rocket, TrendingUp, Lightbulb, Trash2
} from 'lucide-react'

import { AppShell } from '../components/layout/AppShell'
import BillingStats from '../components/billing/BillingStats'
import InvoiceTable from '../components/billing/InvoiceTable'
import { billingApi } from '../features/billing/api'
import type { InvoiceListItem, InvoiceStats, PaymentStatus } from '../features/billing/types'

const emptyInvoiceStats: InvoiceStats = {
  total_invoices: 0, total_sales_amount: 0, total_discount_given: 0,
  total_profit: 0, today_sales: 0, monthly_sales: 0, pending_amount: 0,
  paid_amount: 0, paid_invoices: 0, pending_invoices: 0, partial_invoices: 0,
}

function DeleteInvoiceModal({
  invoice,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  invoice: InvoiceListItem | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!invoice) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm dark:bg-black/50">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl dark:bg-slate-900 dark:shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
          <Trash2 size={24} />
        </div>

        <h3 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">Delete invoice?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Invoice <span className="font-black text-slate-900 dark:text-white">#{invoice.invoice_number}</span> will be marked as cancelled and removed from the saved invoices list.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
          This action cannot be undone from this screen.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDeleting ? 'Deleting...' : 'Delete Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  const navigate = useNavigate()

  const [stats, setStats] = useState<InvoiceStats>(emptyInvoiceStats)
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([])
  const [totalInvoices, setTotalInvoices] = useState(0)
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'all' | PaymentStatus>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isStatsLoading, setIsStatsLoading] = useState(true)
  const [loadErrorMessage, setLoadErrorMessage] = useState('')
  const [actionErrorMessage, setActionErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceListItem | null>(null)
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false)

  const paymentDistribution = useMemo(() => {
    const total = stats.paid_invoices + stats.pending_invoices + stats.partial_invoices
    const getPercent = (value: number) => total === 0 ? 0 : Math.round((value / total) * 100)
    return [
      { label: 'Paid invoices',    value: stats.paid_invoices,    percent: getPercent(stats.paid_invoices),    barClass: 'from-emerald-500 to-teal-500'   },
      { label: 'Pending invoices', value: stats.pending_invoices, percent: getPercent(stats.pending_invoices), barClass: 'from-orange-400 to-rose-500'     },
      { label: 'Partial invoices', value: stats.partial_invoices, percent: getPercent(stats.partial_invoices), barClass: 'from-indigo-500 to-violet-600'   },
    ]
  }, [stats])

  const loadInvoices = async () => {
    try {
      setIsLoading(true)
      setLoadErrorMessage('')
      const data = await billingApi.getInvoices({
        search: search || undefined,
        payment_status: paymentStatus === 'all' ? undefined : paymentStatus,
        invoice_status: 'saved',
        page: 1,
        page_size: 20,
      })
      setInvoices(data.items)
      setTotalInvoices(data.total)
    } catch (error) {
      setLoadErrorMessage(error instanceof Error ? error.message : 'Unable to load invoices')
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      setIsStatsLoading(true)
      const data = await billingApi.getInvoiceStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to load invoice stats', error)
      setStats(emptyInvoiceStats)
    } finally {
      setIsStatsLoading(false)
    }
  }

  const refreshBillingPage = async () => {
    await Promise.all([loadInvoices(), loadStats()])
  }

  useEffect(() => { loadStats() }, [])
  useEffect(() => {
    const timer = setTimeout(() => loadInvoices(), 250)
    return () => clearTimeout(timer)
  }, [search, paymentStatus])

  const handleDownload = (invoiceId: number) => {
    window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/v1/invoices/${invoiceId}/download`, '_blank')
  }
  const handlePrint = (invoiceId: number) => navigate(`/billing/${invoiceId}/preview?print=true`)
  const handleShare = async (invoiceId: number) => {
    try {
      setActionErrorMessage('')
      const data = await billingApi.shareInvoice(invoiceId)
      if (data.whatsapp_url) window.open(data.whatsapp_url, '_blank')
    } catch (error) {
      console.error('Failed to share invoice', error)
      setActionErrorMessage(error instanceof Error ? error.message : 'Unable to share invoice')
    }
  }

  const handleRequestDelete = (invoiceId: number) => {
    const targetInvoice = invoices.find((invoice) => invoice.id === invoiceId) || null

    if (!targetInvoice) return

    setActionErrorMessage('')
    setSuccessMessage('')
    setInvoiceToDelete(targetInvoice)
  }

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return

    try {
      setIsDeletingInvoice(true)
      setActionErrorMessage('')
      setSuccessMessage('')

      const { message } = await billingApi.deleteInvoice(invoiceToDelete.id)
      const deletedInvoiceNumber = invoiceToDelete.invoice_number

      setInvoiceToDelete(null)
      setSuccessMessage(message || `Invoice #${deletedInvoiceNumber} deleted successfully`)
      await refreshBillingPage()
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : 'Unable to delete invoice')
    } finally {
      setIsDeletingInvoice(false)
    }
  }

  return (
    <AppShell>
      <DeleteInvoiceModal
        invoice={invoiceToDelete}
        isDeleting={isDeletingInvoice}
        onCancel={() => {
          if (isDeletingInvoice) return
          setInvoiceToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
      />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >

          {/* ── Page header ── */}
          <div className="mb-6 flex flex-col gap-5 sm:mb-8 sm:gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              {/* Pill badge */}
              <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-indigo-100 dark:border-indigo-900 bg-white/70 dark:bg-slate-800/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl sm:px-4 sm:py-2 sm:text-[11px]">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse sm:h-2.5 sm:w-2.5" />
                Ledger › Invoices
              </div>

              <h1 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-slate-950 dark:text-slate-100 sm:text-[36px] md:text-[48px]">
                Billing & Ledger
              </h1>

              <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-700 dark:text-slate-400 sm:mt-3 sm:text-[18px] sm:leading-8">
                Track invoices, payments, discounts, profit, and customer
                billing history from one focused workspace.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] border border-indigo-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 text-sm font-black text-slate-700 dark:text-slate-300 shadow-[0_14px_36px_rgba(99,102,241,0.08)] transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700 dark:hover:text-indigo-400 sm:h-14 sm:gap-3 sm:rounded-[22px] sm:px-5"
              >
                <Download size={16} className="sm:hidden" />
                <Download size={18} className="hidden sm:block" />
                <span className="hidden xs:inline">Export PDF</span>
              </button>

              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[18px] border border-indigo-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-4 text-sm font-black text-slate-700 dark:text-slate-300 shadow-[0_14px_36px_rgba(99,102,241,0.08)] transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700 dark:hover:text-indigo-400 sm:h-14 sm:gap-3 sm:rounded-[22px] sm:px-5"
              >
                <Filter size={16} className="sm:hidden" />
                <Filter size={18} className="hidden sm:block" />
                <span className="hidden xs:inline">Advanced Filters</span>
              </button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -2 }}
                type="button"
                onClick={() => navigate('/billing/new')}
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-5 text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)] transition-all duration-300 hover:shadow-[0_26px_58px_rgba(79,70,229,0.40)] sm:h-14 sm:gap-3 sm:rounded-[22px] sm:px-7"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/16 transition-transform duration-300 group-hover:rotate-90 sm:h-8 sm:w-8">+</span>
                Create New
              </motion.button>
            </div>
          </div>

          {/* ── Error banner ── */}
          {loadErrorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-start gap-3 rounded-[20px] border border-red-100 dark:border-red-900 bg-red-50/80 dark:bg-red-950/50 p-4 text-red-700 dark:text-red-400 shadow-[0_16px_36px_rgba(220,38,38,0.08)] sm:rounded-[24px] sm:p-5"
            >
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-black">Unable to load billing data</p>
                <p className="mt-1 text-sm leading-6">{loadErrorMessage}</p>
                <button
                  type="button"
                  onClick={refreshBillingPage}
                  className="mt-3 rounded-xl bg-red-600 dark:bg-red-700 px-4 py-2 text-sm font-black text-white transition hover:bg-red-700 dark:hover:bg-red-600"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}

          {actionErrorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-start gap-3 rounded-[20px] border border-red-100 dark:border-red-900 bg-red-50/80 dark:bg-red-950/50 p-4 text-red-700 dark:text-red-400 shadow-[0_16px_36px_rgba(220,38,38,0.08)] sm:rounded-[24px] sm:p-5"
            >
              <AlertCircle className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-black">Unable to complete invoice action</p>
                <p className="mt-1 text-sm leading-6">{actionErrorMessage}</p>
              </div>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-start gap-3 rounded-[20px] border border-emerald-100 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/50 p-4 text-emerald-700 dark:text-emerald-400 shadow-[0_16px_36px_rgba(16,185,129,0.08)] sm:rounded-[24px] sm:p-5"
            >
              <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-black">Invoice deleted</p>
                <p className="mt-1 text-sm leading-6">{successMessage}</p>
              </div>
            </motion.div>
          )}

          {/* ── Stats ── */}
          <BillingStats stats={stats} loading={isStatsLoading} />

          {/* ── Invoice table ── */}
          <div className="mt-6 sm:mt-8">
            <InvoiceTable
              invoices={invoices}
              totalInvoices={totalInvoices}
              isLoading={isLoading}
              search={search}
              onSearchChange={setSearch}
              paymentStatus={paymentStatus}
              onPaymentStatusChange={setPaymentStatus}
              onView={(invoiceId) => navigate(`/billing/${invoiceId}/preview`)}
              onEdit={(invoiceId) => navigate(`/billing/new?edit=${invoiceId}`)}
              onCreate={() => navigate('/billing/new')}
              onPrint={handlePrint}
              onDownload={handleDownload}
              onShare={handleShare}
              onDelete={handleRequestDelete}
              deletingInvoiceId={isDeletingInvoice ? invoiceToDelete?.id ?? null : null}
            />
          </div>

          {/* ── Bottom two-column sections ── */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:mt-8 sm:gap-6 xl:grid-cols-2">

            {/* ── Payment Journey ── */}
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="relative overflow-hidden rounded-[28px] bg-white/85 dark:bg-slate-900/90 border border-transparent dark:border-slate-800 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.07)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:rounded-[34px] sm:p-7"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-100 dark:bg-indigo-900/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-60 w-60 rounded-full bg-purple-100 dark:bg-purple-900/20 blur-3xl" />

              <div className="relative">
                {/* Section header */}
                <div className="mb-5 flex items-start justify-between gap-4 sm:mb-7 sm:gap-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400 sm:text-xs">
                      Payment Journey
                    </p>
                    <h2 className="mt-1.5 text-xl font-black tracking-[-0.035em] text-slate-950 dark:text-slate-100 sm:mt-2 sm:text-2xl">
                      Where Your Invoices Stand
                    </h2>
                    <p className="mt-1 max-w-sm text-xs font-medium leading-5 text-slate-500 dark:text-slate-400 sm:text-sm sm:leading-6">
                      A simple view of how invoices are moving from pending to fully paid.
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 sm:h-12 sm:w-12">
                    <ReceiptText size={20} className="sm:hidden" />
                    <ReceiptText size={22} className="hidden sm:block" />
                  </div>
                </div>

                {/* Distribution cards */}
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {paymentDistribution.map((item, index) => {
                    const isPaid    = item.label.toLowerCase().includes('paid')
                    const isPartial = item.label.toLowerCase().includes('partial')

                    const iconBg = isPaid
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                      : isPartial
                        ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                        : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'

                    const cardBg = isPaid
                      ? 'from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-800/80'
                      : isPartial
                        ? 'from-amber-50 to-white dark:from-amber-950/40 dark:to-slate-800/80'
                        : 'from-rose-50 to-white dark:from-rose-950/40 dark:to-slate-800/80'

                    const titleText   = isPaid ? 'Collected'    : isPartial ? 'In Progress'      : 'Needs Follow-up'
                    const description = isPaid ? 'Invoices fully settled' : isPartial ? 'Part payment received' : 'Payment not received yet'

                    return (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08 * index }}
                        className={`relative overflow-hidden rounded-[24px] bg-gradient-to-br ${cardBg} border border-transparent dark:border-slate-700/50 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.055)] dark:shadow-[0_16px_42px_rgba(0,0,0,0.2)] sm:p-5`}
                      >
                        <div className="mb-4 flex items-start justify-between sm:mb-5">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl sm:h-12 sm:w-12 ${iconBg}`}>
                            {isPaid    ? <><CheckCircle2 size={20} className="sm:hidden" /><CheckCircle2 size={23} className="hidden sm:block" /></>
                             : isPartial ? <><Clock3 size={20} className="sm:hidden" /><Clock3 size={23} className="hidden sm:block" /></>
                             :            <><AlertCircle size={20} className="sm:hidden" /><AlertCircle size={23} className="hidden sm:block" /></>}
                          </div>
                          <div className="rounded-full bg-white/80 dark:bg-slate-800 px-2.5 py-1 text-xs font-black text-slate-700 dark:text-slate-300 shadow-sm">
                            {item.percent}%
                          </div>
                        </div>

                        <p className="text-xs font-black text-slate-500 dark:text-slate-400 sm:text-sm">{item.label}</p>
                        <h3 className="mt-1 text-lg font-black tracking-[-0.035em] text-slate-950 dark:text-slate-100 sm:text-xl">{titleText}</h3>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{description}</p>

                        <div className="mt-4 flex items-end gap-1 sm:mt-6">
                          <span className="text-3xl font-black tracking-[-0.06em] text-slate-950 dark:text-slate-100 sm:text-4xl">{item.percent}</span>
                          <span className="mb-1 text-sm font-black text-slate-400 dark:text-slate-500">%</span>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-700 sm:mt-5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.percent}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                            className={`h-full rounded-full bg-gradient-to-r ${item.barClass}`}
                          />
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.section>

            {/* ── Smart Insights ── */}
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.22 }}
              className="relative overflow-hidden rounded-[28px] bg-white/85 dark:bg-slate-900/90 border border-transparent dark:border-slate-800 p-5 shadow-[0_24px_70px_rgba(99,102,241,0.10)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:rounded-[34px] sm:p-7"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-100 dark:bg-indigo-900/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-100 dark:bg-violet-900/20 blur-3xl" />

              <div className="relative z-10">
                {/* Section header */}
                <div className="mb-5 flex items-center justify-between gap-4 sm:mb-6 sm:gap-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400 sm:text-[11px]">
                      Automated Billing Report
                    </p>
                    <h2 className="mt-1.5 text-xl font-black tracking-[-0.035em] text-slate-950 dark:text-slate-100 sm:mt-2 sm:text-2xl">
                      Smart Insights
                    </h2>
                    <p className="mt-1 max-w-sm text-xs font-medium leading-5 text-slate-500 dark:text-slate-400 sm:text-sm sm:leading-6">
                      Quick business suggestions generated from your invoice data.
                    </p>
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] text-white shadow-[0_18px_42px_rgba(79,70,229,0.28)] sm:h-14 sm:w-14 sm:rounded-[22px]">
                    <Rocket size={22} className="sm:hidden" />
                    <Rocket size={25} className="hidden sm:block" />
                  </div>
                </div>

                {/* Ticket card */}
                <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/50 dark:via-slate-800 dark:to-purple-950/50 border border-transparent dark:border-slate-700/50 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] dark:shadow-[0_18px_48px_rgba(0,0,0,0.2)] sm:rounded-[30px] sm:p-5">
                  {/* Ticket notches */}
                  <div className="absolute left-0 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white dark:bg-slate-900 shadow-inner sm:h-8 sm:w-8" />
                  <div className="absolute right-0 top-1/2 h-6 w-6 translate-x-1/2 -translate-y-1/2 rounded-full bg-white dark:bg-slate-900 shadow-inner sm:h-8 sm:w-8" />

                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-[0_12px_30px_rgba(79,70,229,0.12)] sm:h-12 sm:w-12">
                      <Lightbulb size={19} className="sm:hidden" />
                      <Lightbulb size={22} className="hidden sm:block" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-400">
                          Recommended
                        </span>
                        <span className="rounded-full bg-white dark:bg-slate-700 px-2.5 py-1 text-xs font-black text-slate-500 dark:text-slate-400 shadow-sm">
                          Billing Insight
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-black tracking-[-0.035em] text-slate-950 dark:text-slate-100 sm:mt-4 sm:text-xl">
                        Follow up on unpaid and partial invoices first
                      </h3>
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400 sm:text-sm sm:leading-6">
                        Use payment status and remaining amount to quickly identify invoices that still need collection.
                      </p>
                    </div>
                  </div>

                  <div className="my-4 h-px bg-gradient-to-r from-transparent via-indigo-100 dark:via-indigo-800 to-transparent sm:my-5" />

                  {/* Action summary mini-cards */}
                  <div className="grid grid-cols-1 gap-2 xs:grid-cols- sm:gap-3">
                    <div className="rounded-2xl bg-white/80 dark:bg-slate-800 p-3 shadow-sm sm:p-4">
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 sm:mb-3 sm:h-9 sm:w-9">
                        <AlertCircle size={16} className="sm:hidden" />
                        <AlertCircle size={18} className="hidden sm:block" />
                      </div>
                      <p className="text-sm font-black text-slate-950 dark:text-slate-100">Check Dues</p>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">Find unpaid invoices.</p>
                    </div>

                    <div className="rounded-2xl bg-white/80 dark:bg-slate-800 p-3 shadow-sm sm:p-4">
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 sm:mb-3 sm:h-9 sm:w-9">
                        <Clock3 size={16} className="sm:hidden" />
                        <Clock3 size={18} className="hidden sm:block" />
                      </div>
                      <p className="text-sm font-black text-slate-950 dark:text-slate-100">Track Partial</p>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">Review pending balance.</p>
                    </div>

                    <div className="rounded-2xl bg-white/80 dark:bg-slate-800 p-3 shadow-sm sm:p-4">
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 sm:mb-3 sm:h-9 sm:w-9">
                        <TrendingUp size={16} className="sm:hidden" />
                        <TrendingUp size={18} className="hidden sm:block" />
                      </div>
                      <p className="text-sm font-black text-slate-950 dark:text-slate-100">Review Profit</p>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">Analyze invoice margin.</p>
                    </div>
                  </div>
                </div>

                {/* Bottom insight strip */}
                <div className="mt-3 flex items-start gap-3 rounded-[20px] bg-white/70 dark:bg-slate-800/70 border border-transparent dark:border-slate-700/50 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.045)] backdrop-blur-md sm:mt-4 sm:rounded-[24px] sm:p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 sm:h-9 sm:w-9">
                    <CheckCircle2 size={16} className="sm:hidden" />
                    <CheckCircle2 size={18} className="hidden sm:block" />
                  </div>
                  <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400 sm:text-sm sm:leading-6">
                    Each invoice item stores buy cost, discount, selling amount, and profit,
                    so future reports can show real business performance.
                  </p>
                </div>
              </div>
            </motion.section>

          </div>
        </motion.div>
      </div>
    </AppShell>
  )
}
