import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react'

import { AppShell } from '../components/layout/AppShell'
import CustomerSelector from '../components/billing/CustomerSelector'
import InvoiceItemsTable from '../components/billing/InvoiceItemsTable'
import InvoiceSummaryCard from '../components/billing/InvoiceSummaryCard'
import { billingApi } from '../features/billing/api'
import { invoiceCreateSchema } from '../features/billing/schemas'
import type {
  CustomerPayload,
  InvoiceCreatePayload,
  LocalInvoiceItem,
  PaymentMode,
  PaymentStatus,
} from '../features/billing/types'

const emptyCustomer: CustomerPayload = {
  id: null,
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gst_number: '',
}

export default function CreateInvoicePage() {
  const navigate = useNavigate()

  const [customer, setCustomer] = useState<CustomerPayload>(emptyCustomer)
  const [items, setItems] = useState<LocalInvoiceItem[]>([])
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending')
  const [notes, setNotes] = useState('')

  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.mrp * item.quantity, 0)
    const discount = items.reduce(
      (sum, item) => sum + item.total_discount_amount,
      0
    )
    const tax = 0
    const final = subtotal - discount + tax

    return {
      subtotal,
      discount,
      tax,
      final,
    }
  }, [items])

  const buildPayload = (): InvoiceCreatePayload => {
    return {
      customer,
      items: items.map((item) => ({
        product_id: item.product_id,
        product_code: item.product_code,
        quantity: item.quantity,
        discount_percentage: item.discount_percentage,
        discount_amount_per_unit: item.discount_amount_per_unit,
        selling_price_per_unit: item.selling_price_per_unit,
      })),
      invoice_date: new Date().toISOString().slice(0, 10),
      payment_status: paymentStatus,
      payment_mode: paymentMode || null,
      paid_amount: paidAmount,
      total_tax_amount: totals.tax,
      invoice_status: 'saved',
      notes,
    }
  }

  const saveAndPreview = async () => {
    try {
      setErrorMessage('')
      setSuccessMessage('')

      const payload = buildPayload()
      const parsed = invoiceCreateSchema.safeParse(payload)

      if (!parsed.success) {
        setErrorMessage(
          parsed.error.issues[0]?.message || 'Please check invoice details'
        )
        return
      }

      setIsSaving(true)

      const invoice = await billingApi.createInvoice(parsed.data)

      navigate(`/billing/${invoice.id}/preview`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create invoice'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const saveDraftLocally = () => {
    const payload = buildPayload()

    localStorage.setItem('billing_invoice_draft', JSON.stringify(payload))
    setSuccessMessage('Draft saved locally in this browser.')
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
          >
            <ArrowLeft size={17} />
            Back to Billing
          </button>

          <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl">
                <Sparkles size={14} />
                Billing › New Invoice
              </div>

              <h1 className="text-[42px] font-black tracking-[-0.04em] text-slate-950 md:text-[56px]">
                Create New Invoice
              </h1>

              <p className="mt-3 max-w-2xl text-[18px] leading-8 text-slate-600">
                Select a customer, add products by code, apply discounts, and
                generate a clean invoice.
              </p>
            </div>

            <div className="hidden items-center gap-4 rounded-[28px] bg-white/80 p-4 shadow-[0_18px_48px_rgba(99,102,241,0.08)] backdrop-blur-xl lg:flex">
              <Step active number="1" label="Details" />
              <div className="h-px w-16 bg-slate-200" />
              <Step number="2" label="Review" />
              <div className="h-px w-16 bg-slate-200" />
              <Step number="3" label="Payment" />
            </div>
          </div>

          {errorMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-[24px] border border-red-100 bg-red-50 p-5 text-red-700">
              <AlertCircle size={20} className="mt-0.5" />
              <div>
                <p className="font-black">Unable to create invoice</p>
                <p className="mt-1 text-sm">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 text-emerald-700">
              <CheckCircle2 size={20} className="mt-0.5" />
              <div>
                <p className="font-black">Saved</p>
                <p className="mt-1 text-sm">{successMessage}</p>
              </div>
            </div>
          )}

          <div className="grid gap-8 xl:grid-cols-[1fr_410px]">
            <div className="space-y-8">
              <CustomerSelector
                customer={customer}
                onCustomerChange={setCustomer}
              />

              <InvoiceItemsTable
                items={items}
                onItemsChange={setItems}
              />
            </div>

            <InvoiceSummaryCard
              items={items}
              paidAmount={paidAmount}
              onPaidAmountChange={setPaidAmount}
              paymentMode={paymentMode}
              onPaymentModeChange={setPaymentMode}
              paymentStatus={paymentStatus}
              onPaymentStatusChange={setPaymentStatus}
              notes={notes}
              onNotesChange={setNotes}
              onPreview={saveAndPreview}
              onSaveDraft={saveDraftLocally}
              loading={isSaving}
            />
          </div>
        </motion.div>
      </div>
    </AppShell>
  )
}

function Step({
  number,
  label,
  active = false,
}: {
  number: string
  label: string
  active?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${
          active
            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg'
            : 'bg-slate-100 text-slate-400'
        }`}
      >
        {number}
      </div>
      <span
        className={`text-sm font-black ${
          active ? 'text-indigo-700' : 'text-slate-400'
        }`}
      >
        {label}
      </span>
    </div>
  )
}