import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CreditCard,
  Download,
  Loader2,
  MessageCircle,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Send,
  Share2,
} from 'lucide-react'

import InvoicePreview from '../components/billing/InvoicePreviewDocument'
import { billingApi } from '../features/billing/api'
import type { Invoice, InvoiceReturn, PaymentMethod } from '../features/billing/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/ToastProvider'

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

type RefundForm = {
  amount: string
  method: PaymentMethod
  reference: string
  notes: string
}

function newRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const money = (value: string | number) => {
  return Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

export default function InvoicePreviewPage() {
  const navigate = useNavigate()
  const { invoiceId } = useParams()
  const [searchParams] = useSearchParams()
  const { user, shop } = useAuth()
  const { showToast } = useToast()

  const id = Number(invoiceId)

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSharing, setIsSharing] = useState(false)
  const [isRecordingPayment, setIsRecordingPayment] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [isCreatingReturn, setIsCreatingReturn] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({})
  const [isRefundingReturnId, setIsRefundingReturnId] = useState<number | null>(null)
  const [refundForms, setRefundForms] = useState<Record<number, RefundForm>>({})

  const shopInfo = useMemo(() => {
    return {
      name: shop?.name || user?.shop_name || 'Store',
      logoUrl: shop?.logo_url || user?.shop_logo_url || null,
      email: shop?.email || user?.email || null,
      phone: shop?.phone || shop?.whatsapp_number || null,
      address: shop?.address || null,
      city: shop?.city || null,
      state: shop?.state || null,
      pincode: shop?.pincode || null,
      ownerName: user?.full_name || null,
    }
  }, [shop, user])

  const loadInvoice = async () => {
    try {
      setIsLoading(true)
      setErrorMessage('')
      const data = await billingApi.getInvoice(id)
      setInvoice(data)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load invoice'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const setInvoiceDocumentTitle = () => {
    if (!invoice) return
    document.title = invoice.invoice_number
  }

  const handlePrint = () => {
    setInvoiceDocumentTitle()
    setTimeout(() => window.print(), 100)
  }

  const handleShare = async () => {
    try {
      setIsSharing(true)
      const data = await billingApi.shareInvoice(id)
      if (data.whatsapp_url) {
        window.open(data.whatsapp_url, '_blank')
      }
    } catch (error) {
      console.error('Failed to share invoice', error)
    } finally {
      setIsSharing(false)
    }
  }

  const handleDownload = () => {
    setInvoiceDocumentTitle()
    setTimeout(() => window.print(), 100)
  }

  const handleRecordPayment = async () => {
    if (!invoice) return
    const amount = Number(paymentAmount || 0)

    try {
      setIsRecordingPayment(true)
      await billingApi.addInvoicePayment(invoice.id, {
        client_request_id: newRequestId(),
        amount,
        payment_method: paymentMethod,
        payment_reference: paymentReference || null,
        notes: paymentNotes || null,
      })
      setPaymentAmount('')
      setPaymentReference('')
      setPaymentNotes('')
      await loadInvoice()
      showToast({
        title: 'Payment recorded',
        message: 'Invoice payment history has been updated.',
        variant: 'success',
      })
    } catch (error) {
      showToast({
        title: 'Unable to record payment',
        message: error instanceof Error ? error.message : 'Unable to record payment',
        variant: 'error',
      })
    } finally {
      setIsRecordingPayment(false)
    }
  }

  const returnedQuantityByItem = useMemo(() => {
    const totals: Record<number, number> = {}
    invoice?.returns?.forEach((returnRecord) => {
      returnRecord.items.forEach((item) => {
        totals[item.invoice_item_id] = (totals[item.invoice_item_id] || 0) + Number(item.quantity || 0)
      })
    })
    return totals
  }, [invoice])

  const returnableItems = useMemo(() => {
    if (!invoice) return []
    return invoice.items
      .map((item) => {
        const soldQuantity = Number(item.quantity || 0)
        const returnedQuantity = returnedQuantityByItem[item.id] || 0
        return {
          item,
          remaining: Math.max(soldQuantity - returnedQuantity, 0),
        }
      })
      .filter((entry) => entry.remaining > 0)
  }, [invoice, returnedQuantityByItem])

  const handleCreateReturn = async () => {
    if (!invoice) return
    const items = returnableItems
      .map(({ item, remaining }) => {
        const quantity = Number(returnQuantities[item.id] || 0)
        return {
          invoice_item_id: item.id,
          quantity: Math.min(Math.max(quantity, 0), remaining),
        }
      })
      .filter((item) => item.quantity > 0)

    if (!items.length) {
      showToast({
        title: 'Select return quantity',
        message: 'Enter at least one quantity to return.',
        variant: 'error',
      })
      return
    }

    try {
      setIsCreatingReturn(true)
      await billingApi.createInvoiceReturn(invoice.id, {
        client_request_id: newRequestId(),
        reason: returnReason.trim() || 'Customer return',
        notes: returnNotes.trim() || null,
        items,
      })
      setReturnReason('')
      setReturnNotes('')
      setReturnQuantities({})
      await loadInvoice()
      showToast({
        title: 'Return recorded',
        message: 'Stock, credit note, and invoice balance have been updated.',
        variant: 'success',
      })
    } catch (error) {
      showToast({
        title: 'Unable to record return',
        message: error instanceof Error ? error.message : 'Unable to record return',
        variant: 'error',
      })
    } finally {
      setIsCreatingReturn(false)
    }
  }

  const getRefundForm = (returnId: number) => {
    return refundForms[returnId] || {
      amount: '',
      method: 'cash' as PaymentMethod,
      reference: '',
      notes: '',
    }
  }

  const updateRefundForm = (returnId: number, patch: Partial<RefundForm>) => {
    setRefundForms((current) => ({
      ...current,
      [returnId]: {
        ...getRefundForm(returnId),
        ...patch,
      },
    }))
  }

  const refundableBalance = (returnRecord: InvoiceReturn) => {
    const refunded = returnRecord.refunds?.reduce((sum, refund) => sum + Number(refund.amount || 0), 0) || 0
    return Math.max(Number(returnRecord.refundable_amount || 0) - refunded, 0)
  }

  const handleRecordRefund = async (returnRecord: InvoiceReturn) => {
    const form = getRefundForm(returnRecord.id)
    const amount = Number(form.amount || 0)
    const remaining = refundableBalance(returnRecord)

    if (amount <= 0 || amount > remaining) {
      showToast({
        title: 'Invalid refund amount',
        message: `Refund amount must be between ₹0 and ${money(remaining)}.`,
        variant: 'error',
      })
      return
    }

    try {
      setIsRefundingReturnId(returnRecord.id)
      await billingApi.addReturnRefund(returnRecord.id, {
        client_request_id: newRequestId(),
        amount,
        refund_method: form.method,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      })
      setRefundForms((current) => ({
        ...current,
        [returnRecord.id]: {
          amount: '',
          method: form.method,
          reference: '',
          notes: '',
        },
      }))
      await loadInvoice()
      showToast({
        title: 'Refund recorded',
        message: 'Refund history has been updated.',
        variant: 'success',
      })
    } catch (error) {
      showToast({
        title: 'Unable to record refund',
        message: error instanceof Error ? error.message : 'Unable to record refund',
        variant: 'error',
      })
    } finally {
      setIsRefundingReturnId(null)
    }
  }

  useEffect(() => {
    if (!Number.isNaN(id)) {
      loadInvoice()
    }
  }, [id])

  useEffect(() => {
    if (!invoice) return
    const previousTitle = document.title
    document.title = invoice.invoice_number
    return () => {
      document.title = previousTitle
    }
  }, [invoice])

  useEffect(() => {
    if (invoice && searchParams.get('print') === 'true') {
      setTimeout(() => window.print(), 500)
    }
  }, [invoice, searchParams])

  if (isLoading) {
    return (
        <div className="mx-auto max-w-[1200px]">
          <div className="flex min-h-[520px] items-center justify-center rounded-[34px] bg-white/80 dark:bg-slate-800/80">
            <Loader2 size={34} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
    )
  }

  if (!invoice || errorMessage) {
    return (
        <div className="mx-auto max-w-[760px] rounded-[34px] bg-white/80 dark:bg-slate-800/80 p-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.07)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">
            Invoice not found
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{errorMessage}</p>
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="mt-6 rounded-2xl bg-slate-950 dark:bg-white px-5 py-3 text-sm font-black text-white dark:text-slate-950"
          >
            Back to Billing
          </button>
        </div>
    )
  }

  const remainingAmount = Number(invoice.remaining_amount || 0)
  const canRecordPayment = invoice.invoice_status !== 'cancelled' && remainingAmount > 0

  return (
    <>
      <style>
        {`
          .invoice-a4 {
            width: 210mm;
            min-height: 297mm;
            border-radius: 28px;
          }

          .invoice-page {
            padding: 18mm;
          }

          .invoice-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          @page {
            size: A4;
            margin: 0;
          }

          @media print {
            html,
            body {
              width: 210mm;
              min-height: 297mm;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
            }

            body * {
              visibility: hidden !important;
            }

            #invoice-print-area,
            #invoice-print-area * {
              visibility: visible !important;
            }

            #invoice-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 210mm !important;
              min-height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }

            .invoice-page {
              padding: 14mm !important;
            }

            .invoice-row {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            a[href]:after {
              content: "" !important;
            }
          }
        `}
      </style>

      <div className="mx-auto mt-2 max-w-[1400px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="print:hidden"
        >
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 dark:border-slate-700 bg-white/75 dark:bg-slate-800/75 px-4 py-2.5 text-sm font-black text-slate-700 dark:text-slate-300 shadow-[0_12px_30px_rgba(99,102,241,0.08)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.2)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700 dark:hover:text-indigo-400"
          >
            <ArrowLeft size={17} />
            Back to Billing
          </button>

          <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              {/* Badge */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 dark:border-indigo-800 bg-white/70 dark:bg-indigo-950/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl">
                <Send size={14} />
                Invoice Preview
              </div>

              <h1 className="text-[36px] font-black tracking-[-0.04em] text-slate-950 dark:text-white md:text-[48px]">
                Invoice #{invoice.invoice_number}
              </h1>

              <p className="mt-3 max-w-2xl text-[17px] leading-8 text-slate-600 dark:text-slate-400">
                Review, print, download, or share this invoice with the customer.
              </p>
            </div>

            {/* Action buttons row */}
            <div className="flex flex-wrap gap-3">
              <ActionButton
                icon={Pencil}
                label="Edit"
                onClick={() => navigate(`/billing/new?edit=${invoice.id}`)}
              />
              <ActionButton icon={Save} label="Refresh" onClick={loadInvoice} />
              <ActionButton icon={Printer} label="Print" onClick={handlePrint} />
              <ActionButton
                icon={Download}
                label="Save PDF"
                onClick={handleDownload}
              />

              <button
                type="button"
                onClick={handleShare}
                disabled={isSharing}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] px-5 text-sm font-black text-white shadow-[0_18px_42px_rgba(79,70,229,0.28)] transition hover:-translate-y-[1px] disabled:opacity-70"
              >
                {isSharing ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <MessageCircle size={17} />
                )}
                WhatsApp
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-8 xl:grid-cols-[1fr_330px] print:block">
          <div>
            <InvoicePreview invoice={invoice} shopInfo={shopInfo} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 print:hidden">
            <div className="rounded-[34px] bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
              <p className="mb-5 text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Invoice Actions
              </p>

              {/* Primary CTA */}
              <button
                type="button"
                onClick={handleShare}
                className="mb-4 inline-flex h-14 w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)]"
              >
                <Share2 size={18} />
                Send to Customer
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/billing/new?edit=${invoice.id}`)}
                  className="h-14 rounded-[20px] bg-slate-100 dark:bg-slate-700 text-sm font-black text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={loadInvoice}
                  className="h-14 rounded-[20px] bg-slate-100 dark:bg-slate-700 text-sm font-black text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Refresh
                </button>
              </div>

              <div className="my-6 h-px bg-slate-200 dark:bg-slate-700" />

              <div className="space-y-3">
                <SideAction icon={Printer} label="Print Invoice" onClick={handlePrint} />
                <SideAction icon={Download} label="Save as PDF" onClick={handleDownload} />
                <SideAction icon={Share2} label="Share Link" onClick={handleShare} />
              </div>
            </div>

            <div className="rounded-[34px] bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:bg-slate-800/80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
              <div className="mb-5 flex items-center gap-3">
                <CreditCard size={19} className="text-indigo-600 dark:text-indigo-400" />
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Record Payment
                </p>
              </div>

              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3 rounded-[22px] bg-slate-50 p-4 dark:bg-slate-700/50">
                  <MiniValue label="Paid" value={money(invoice.paid_amount)} />
                  <MiniValue label="Balance" value={money(invoice.remaining_amount)} danger />
                </div>

                <input
                  type="number"
                  min={0}
                  max={remainingAmount}
                  step="0.01"
                  value={paymentAmount}
                  disabled={!canRecordPayment}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    const amount = nextValue === '' ? '' : String(Math.min(Math.max(Number(nextValue), 0), remainingAmount))
                    setPaymentAmount(amount)
                  }}
                  placeholder="Amount"
                  className="h-12 rounded-[18px] border border-indigo-100 bg-white px-4 text-sm font-bold text-slate-800 outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />

                <select
                  value={paymentMethod}
                  disabled={!canRecordPayment}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="h-12 rounded-[18px] border border-indigo-100 bg-white px-4 text-sm font-bold text-slate-800 outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>

                <input
                  value={paymentReference}
                  disabled={!canRecordPayment}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Reference optional"
                  className="h-12 rounded-[18px] border border-indigo-100 bg-white px-4 text-sm font-bold text-slate-800 outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />

                <textarea
                  value={paymentNotes}
                  disabled={!canRecordPayment}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Note optional"
                  rows={3}
                  className="resize-none rounded-[18px] border border-indigo-100 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />

                <button
                  type="button"
                  disabled={!canRecordPayment || isRecordingPayment || Number(paymentAmount || 0) <= 0}
                  onClick={handleRecordPayment}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[18px] bg-indigo-600 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRecordingPayment ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  Record Payment
                </button>

                {!canRecordPayment && (
                  <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                    Payments can be recorded only while the invoice has an outstanding balance and is not cancelled.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[34px] bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:bg-slate-800/80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
              <div className="mb-5 flex items-center gap-3">
                <RotateCcw size={19} className="text-rose-600 dark:text-rose-400" />
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Returns
                </p>
              </div>

              <div className="space-y-4">
                {returnableItems.length > 0 && invoice.invoice_status !== 'cancelled' ? (
                  <>
                    <div className="space-y-3">
                      {returnableItems.map(({ item, remaining }) => (
                        <div key={item.id} className="rounded-[18px] bg-slate-50 p-3 dark:bg-slate-700/50">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-900 dark:text-white">
                                {item.product_name_snapshot}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Returnable: {remaining}
                              </p>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={remaining}
                              step={1}
                              value={returnQuantities[item.id] || ''}
                              onChange={(event) => {
                                const value = event.target.value
                                const quantity = value === '' ? '' : String(Math.min(Math.max(Number(value), 0), remaining))
                                setReturnQuantities((current) => ({ ...current, [item.id]: quantity }))
                              }}
                              className="h-10 w-24 rounded-[14px] border border-rose-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <input
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                      placeholder="Reason"
                      className="h-12 w-full rounded-[18px] border border-rose-100 bg-white px-4 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    />

                    <textarea
                      value={returnNotes}
                      onChange={(event) => setReturnNotes(event.target.value)}
                      placeholder="Note optional"
                      rows={3}
                      className="w-full resize-none rounded-[18px] border border-rose-100 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    />

                    <button
                      type="button"
                      disabled={isCreatingReturn}
                      onClick={handleCreateReturn}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-rose-600 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingReturn ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                      Record Return
                    </button>
                  </>
                ) : (
                  <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                    No returnable items are available for this invoice.
                  </p>
                )}

                {invoice.returns?.length > 0 && (
                  <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                    {invoice.returns.map((returnRecord) => {
                      const remainingRefund = refundableBalance(returnRecord)
                      const form = getRefundForm(returnRecord.id)
                      return (
                        <div key={returnRecord.id} className="rounded-[20px] border border-rose-100 bg-rose-50/70 p-4 dark:border-rose-900/70 dark:bg-rose-950/20">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-900 dark:text-white">
                                {returnRecord.credit_note_number}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {returnRecord.return_number} · {returnRecord.reason}
                              </p>
                            </div>
                            <p className="text-sm font-black text-rose-700 dark:text-rose-300">
                              {money(returnRecord.total_amount)}
                            </p>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                            <MiniValue label="Outstanding Credit" value={money(returnRecord.applied_to_outstanding_amount)} />
                            <MiniValue label="Refundable" value={money(remainingRefund)} />
                          </div>

                          {remainingRefund > 0 && (
                            <div className="mt-3 grid gap-2">
                              <input
                                type="number"
                                min={0}
                                max={remainingRefund}
                                step="0.01"
                                value={form.amount}
                                onChange={(event) => {
                                  const value = event.target.value
                                  const amount = value === '' ? '' : String(Math.min(Math.max(Number(value), 0), remainingRefund))
                                  updateRefundForm(returnRecord.id, { amount })
                                }}
                                placeholder="Refund amount"
                                className="h-10 rounded-[14px] border border-rose-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              />
                              <select
                                value={form.method}
                                onChange={(event) => updateRefundForm(returnRecord.id, { method: event.target.value as PaymentMethod })}
                                className="h-10 rounded-[14px] border border-rose-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                {paymentMethods.map((method) => (
                                  <option key={method.value} value={method.value}>
                                    {method.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                value={form.reference}
                                onChange={(event) => updateRefundForm(returnRecord.id, { reference: event.target.value })}
                                placeholder="Reference optional"
                                className="h-10 rounded-[14px] border border-rose-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              />
                              <button
                                type="button"
                                disabled={isRefundingReturnId === returnRecord.id || Number(form.amount || 0) <= 0}
                                onClick={() => handleRecordRefund(returnRecord)}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-slate-950 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950"
                              >
                                {isRefundingReturnId === returnRecord.id && <Loader2 size={14} className="animate-spin" />}
                                Record Refund
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Tip card */}
            <div className="rounded-[30px] bg-indigo-50/80 dark:bg-indigo-950/50 p-6 shadow-[0_18px_44px_rgba(99,102,241,0.08)] dark:shadow-[0_18px_44px_rgba(99,102,241,0.15)]">
              <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                PDF Export Tip
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Click Save as PDF, choose Save to PDF in the print dialog, and
                the default document name will use this invoice number.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Share2
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-13 items-center justify-center gap-2 rounded-[20px] border border-indigo-100 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-5 text-sm font-black text-slate-700 dark:text-slate-300 shadow-[0_14px_36px_rgba(99,102,241,0.08)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700 dark:hover:text-indigo-400 dark:hover:border-indigo-700"
    >
      <Icon size={17} />
      {label}
    </button>
  )
}

function SideAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Share2
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left text-sm font-black text-slate-700 dark:text-slate-300 transition hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-400"
    >
      <Icon size={17} />
      {label}
    </button>
  )
}

function MiniValue({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-black ${
          danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
