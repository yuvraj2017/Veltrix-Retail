import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  // ArrowUpRight,
  Download,
  Filter,
  ReceiptText,
  CheckCircle2,
  Clock3,
  Rocket,
  Sparkles,
  TrendingUp,
  Lightbulb
} from 'lucide-react'


import { AppShell } from '../components/layout/AppShell'
import BillingStats from '../components/billing/BillingStats'
import InvoiceTable from '../components/billing/InvoiceTable'
import { billingApi } from '../features/billing/api'
import type {
  InvoiceListItem,
  InvoiceStats,
  PaymentStatus,
} from '../features/billing/types'

const emptyInvoiceStats: InvoiceStats = {
  total_invoices: 0,
  total_sales_amount: 0,
  total_discount_given: 0,
  total_profit: 0,
  today_sales: 0,
  monthly_sales: 0,
  pending_amount: 0,
  paid_amount: 0,
  paid_invoices: 0,
  pending_invoices: 0,
  partial_invoices: 0,
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
  const [errorMessage, setErrorMessage] = useState('')

  const paymentDistribution = useMemo(() => {
    const total =
      stats.paid_invoices + stats.pending_invoices + stats.partial_invoices

    const getPercent = (value: number) => {
      if (total === 0) return 0
      return Math.round((value / total) * 100)
    }

    return [
      {
        label: 'Paid invoices',
        value: stats.paid_invoices,
        percent: getPercent(stats.paid_invoices),
        barClass: 'from-emerald-500 to-teal-500',
      },
      {
        label: 'Pending invoices',
        value: stats.pending_invoices,
        percent: getPercent(stats.pending_invoices),
        barClass: 'from-orange-400 to-rose-500',
      },
      {
        label: 'Partial invoices',
        value: stats.partial_invoices,
        percent: getPercent(stats.partial_invoices),
        barClass: 'from-indigo-500 to-violet-600',
      },
    ]
  }, [stats])

  const loadInvoices = async () => {
    try {
      setIsLoading(true)
      setErrorMessage('')

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
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load invoices'
      )
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

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInvoices()
    }, 250)

    return () => clearTimeout(timer)
  }, [search, paymentStatus])

  const handleDownload = (invoiceId: number) => {
    window.open(
      `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/v1/invoices/${invoiceId}/download`,
      '_blank'
    )
  }

  const handlePrint = (invoiceId: number) => {
    navigate(`/billing/${invoiceId}/preview?print=true`)
  }

  const handleShare = async (invoiceId: number) => {
    try {
      const data = await billingApi.shareInvoice(invoiceId)

      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, '_blank')
      }
    } catch (error) {
      console.error('Failed to share invoice', error)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl">
                <Sparkles size={14} />
                Ledger › Invoices
              </div>

              <h1 className="text-[42px] font-black tracking-[-0.04em] text-slate-950 md:text-[56px]">
                Billing & Ledger
              </h1>

              <p className="mt-3 max-w-2xl text-[18px] leading-8 text-slate-600">
                Track invoices, payments, discounts, profit, and customer
                billing history from one focused workspace.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-[22px] border border-indigo-100 bg-white/80 px-5 text-sm font-black text-slate-700 shadow-[0_14px_36px_rgba(99,102,241,0.08)] transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
              >
                <Download size={18} />
                Export PDF
              </button>

              <button
                type="button"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-[22px] border border-indigo-100 bg-white/80 px-5 text-sm font-black text-slate-700 shadow-[0_14px_36px_rgba(99,102,241,0.08)] transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
              >
                <Filter size={18} />
                Advanced Filters
              </button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -2 }}
                type="button"
                onClick={() => navigate('/billing/new')}
                className="group inline-flex h-14 items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] px-7 text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)] transition-all duration-300 hover:shadow-[0_26px_58px_rgba(79,70,229,0.40)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/16 transition-transform duration-300 group-hover:rotate-90">
                  +
                </span>
                Create New
              </motion.button>
            </div>
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-start gap-3 rounded-[24px] border border-red-100 bg-red-50/80 p-5 text-red-700 shadow-[0_16px_36px_rgba(220,38,38,0.08)]"
            >
              <AlertCircle className="mt-0.5 shrink-0" size={20} />

              <div>
                <p className="font-black">Unable to load billing data</p>
                <p className="mt-1 text-sm leading-6">{errorMessage}</p>

                <button
                  type="button"
                  onClick={refreshBillingPage}
                  className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white transition hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}

          <BillingStats stats={stats} loading={isStatsLoading} />

          <div className="mt-8">
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
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
            {/* <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="rounded-[34px] bg-white/80 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            >
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-[-0.035em] text-slate-950">
                    Payment Distribution
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Based on current invoice payment status.
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <ReceiptText size={22} />
                </div>
              </div>

              <div className="space-y-5">
                {paymentDistribution.map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-black text-slate-700">
                        {item.label}
                      </p>
                      <p className="text-sm font-black text-slate-950">
                        {item.percent}%
                      </p>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percent}%` }}
                        transition={{ duration: 0.6 }}
                        className={`h-full rounded-full bg-gradient-to-r ${item.barClass}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.section> */}

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="relative overflow-hidden rounded-[34px] bg-white/85 p-7 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-100 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-60 w-60 rounded-full bg-purple-100 blur-3xl" />

              <div className="relative">
                <div className="mb-7 flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">
                      Payment Journey
                    </p>

                    <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950">
                      Where Your Invoices Stand
                    </h2>

                    <p className="mt-1 max-w-sm text-sm font-medium leading-6 text-slate-500">
                      A simple view of how invoices are moving from pending to fully paid.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <ReceiptText size={22} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {paymentDistribution.map((item, index) => {
                    const isPaid = item.label.toLowerCase().includes("paid");
                    const isPartial = item.label.toLowerCase().includes("partial");

                    const iconBg = isPaid
                      ? "bg-emerald-50 text-emerald-600"
                      : isPartial
                        ? "bg-amber-50 text-amber-600"
                        : "bg-rose-50 text-rose-600";

                    const cardBg = isPaid
                      ? "from-emerald-50 to-white"
                      : isPartial
                        ? "from-amber-50 to-white"
                        : "from-rose-50 to-white";

                    const titleText = isPaid
                      ? "Collected"
                      : isPartial
                        ? "In Progress"
                        : "Needs Follow-up";

                    const description = isPaid
                      ? "Invoices fully settled"
                      : isPartial
                        ? "Part payment received"
                        : "Payment not received yet";

                    return (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08 * index }}
                        className={`relative overflow-hidden rounded-[28px] bg-gradient-to-br ${cardBg} p-5 shadow-[0_16px_42px_rgba(15,23,42,0.055)]`}
                      >
                        <div className="mb-5 flex items-start justify-between">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg}`}>
                            {isPaid ? (
                              <CheckCircle2 size={23} />
                            ) : isPartial ? (
                              <Clock3 size={23} />
                            ) : (
                              <AlertCircle size={23} />
                            )}
                          </div>

                          <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm">
                            {item.percent}%
                          </div>
                        </div>

                        <p className="text-sm font-black text-slate-500">
                          {item.label}
                        </p>

                        <h3 className="mt-1 text-xl font-black tracking-[-0.035em] text-slate-950">
                          {titleText}
                        </h3>

                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                          {description}
                        </p>

                        <div className="mt-6 flex items-end gap-1">
                          <span className="text-4xl font-black tracking-[-0.06em] text-slate-950">
                            {item.percent}
                          </span>
                          <span className="mb-1.5 text-sm font-black text-slate-400">
                            %
                          </span>
                        </div>

                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.percent}%` }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                            className={`h-full rounded-full bg-gradient-to-r ${item.barClass}`}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.section>
{/* 
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.22 }}
              className="relative overflow-hidden rounded-[34px] border border-indigo-100 bg-indigo-50/80 p-8 shadow-[0_24px_70px_rgba(99,102,241,0.10)] backdrop-blur-xl"
            >
              <div className="relative z-10 flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] text-white shadow-[0_20px_48px_rgba(79,70,229,0.32)]">
                  <Rocket size={28} />
                </div>

                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600">
                    Automated Billing Report
                  </p>

                  <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950">
                    Smart Insights
                  </h2>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-[24px] bg-white/90 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                      <p className="font-black text-slate-950">
                        Faster settlement tracking
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Use payment status and remaining amount to monitor dues
                        and follow-ups.
                      </p>
                    </div>

                    <div className="rounded-[24px] bg-white/90 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
                      <p className="font-black text-slate-950">
                        Profit-ready invoice data
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Each invoice item stores buy cost, discount, selling
                        amount, and profit for future reports.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/45 blur-2xl" />
            </motion.section> */}


            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.22 }}
              className="relative overflow-hidden rounded-[34px] bg-white/85 p-7 shadow-[0_24px_70px_rgba(99,102,241,0.10)] backdrop-blur-xl"
            >
              {/* Soft background shapes */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-100 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-100 blur-3xl" />

              <div className="relative z-10">
                <div className="mb-6 flex items-center justify-between gap-5">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600">
                      Automated Billing Report
                    </p>

                    <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950">
                      Smart Insights
                    </h2>

                    <p className="mt-1 max-w-sm text-sm font-medium leading-6 text-slate-500">
                      Quick business suggestions generated from your invoice data.
                    </p>
                  </div>

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] text-white shadow-[0_18px_42px_rgba(79,70,229,0.28)]">
                    <Rocket size={25} />
                  </div>
                </div>

                {/* Ticket card */}
                <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                  {/* Ticket dotted divider */}
                  <div className="absolute left-0 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-inner" />
                  <div className="absolute right-0 top-1/2 h-8 w-8 translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-inner" />

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-[0_12px_30px_rgba(79,70,229,0.12)]">
                      <Lightbulb size={22} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          Recommended
                        </span>

                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 shadow-sm">
                          Billing Insight
                        </span>
                      </div>

                      <h3 className="mt-4 text-xl font-black tracking-[-0.035em] text-slate-950">
                        Follow up on unpaid and partial invoices first
                      </h3>

                      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                        Use payment status and remaining amount to quickly identify invoices
                        that still need collection.
                      </p>
                    </div>
                  </div>

                  <div className="my-5 h-px bg-gradient-to-r from-transparent via-indigo-100 to-transparent" />

                  {/* Simple action summary */}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <AlertCircle size={18} />
                      </div>
                      <p className="text-sm font-black text-slate-950">Check Dues</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        Find unpaid invoices.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <Clock3 size={18} />
                      </div>
                      <p className="text-sm font-black text-slate-950">Track Partial</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        Review pending balance.
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <TrendingUp size={18} />
                      </div>
                      <p className="text-sm font-black text-slate-950">Review Profit</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                        Analyze invoice margin.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom small insight */}
                <div className="mt-4 flex items-start gap-3 rounded-[24px] bg-white/70 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)] backdrop-blur-md">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={18} />
                  </div>

                  <p className="text-sm font-semibold leading-6 text-slate-500">
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
