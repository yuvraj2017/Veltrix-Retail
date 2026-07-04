import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

import { AppShell } from '../components/layout/AppShell'
import CustomerSelector from '../components/billing/CustomerSelector'
import InvoiceItemsTable from '../components/billing/InvoiceItemsTable'
import InvoiceSummaryCard from '../components/billing/InvoiceSummaryCard'
import { billingApi } from '../features/billing/api'
import { invoiceCreateSchema } from '../features/billing/schemas'
import type {
  CustomerPayload,
  Invoice,
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

function splitName(fullName?: string | null) {
  const value = (fullName || '').trim()
  if (!value) return { first_name: '', last_name: '' }

  const parts = value.split(' ')
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
  }
}

function mapInvoiceToCustomer(invoice: Invoice): CustomerPayload {
  const nameParts = splitName(invoice.customer_name_snapshot)

  return {
    id: invoice.customer_id ?? null,
    first_name: nameParts.first_name,
    last_name: nameParts.last_name,
    phone: invoice.customer_phone_snapshot || '',
    email: invoice.customer_email_snapshot || '',
    address: invoice.customer_address_snapshot || '',
    city: invoice.customer_city_snapshot || '',
    state: invoice.customer_state_snapshot || '',
    pincode: invoice.customer_pincode_snapshot || '',
    gst_number: invoice.customer_gst_number_snapshot || '',
  }
}

function mapInvoiceItemToLocalItem(item: any): LocalInvoiceItem {
  return {
    product_id: item.product_id,
    product_code: item.product_code,
    product_name: item.product_name_snapshot,
    category: item.category_snapshot || '',
    unit: item.unit_snapshot || '',
    mrp: Number(item.mrp || 0),
    buy_price: Number(item.buy_price || 0),
    available_stock: Number(item.quantity || 0),
    quantity: Number(item.quantity || 0),
    discount_percentage: Number(item.discount_percentage || 0),
    discount_amount_per_unit: Number(item.discount_amount_per_unit || 0),
    selling_price_per_unit: Number(item.selling_price_per_unit || 0),
    total_discount_amount: Number(item.total_discount_amount || 0),
    total_selling_price: Number(item.total_selling_price || 0),
    total_buy_cost: Number(item.total_buy_cost || 0),
    profit_per_unit: Number(item.profit_per_unit || 0),
    total_profit: Number(item.total_profit || 0),
  }
}

export default function CreateInvoicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const editParam = searchParams.get('edit')
  const editInvoiceId = editParam ? Number(editParam) : null
  const isEditMode = !!editInvoiceId && !Number.isNaN(editInvoiceId)

  const [customer, setCustomer] = useState<CustomerPayload>(emptyCustomer)
  const [items, setItems] = useState<LocalInvoiceItem[]>([])

  const [paidAmount, setPaidAmount] = useState(0)
  const [totalPayable, setTotalPayable] = useState(0)
  const [isPayableManuallyEdited, setIsPayableManuallyEdited] = useState(false)

  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending')
  const [notes, setNotes] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))

  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false)

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.mrp * item.quantity, 0)
    const discount = items.reduce((sum, item) => sum + item.total_discount_amount, 0)
    const tax = 0
    const final = subtotal - discount + tax

    return {
      subtotal,
      discount,
      tax,
      final,
    }
  }, [items])

  const totalBilledAmount = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + Number(item.total_selling_price || 0),
      0
    )
  }, [items])

  useEffect(() => {
    setTotalPayable((currentTotalPayable) => {
      if (!isPayableManuallyEdited) {
        return totalBilledAmount
      }

      return Math.min(currentTotalPayable, totalBilledAmount)
    })
  }, [isPayableManuallyEdited, totalBilledAmount])

  useEffect(() => {
    setPaidAmount((currentPaidAmount) => Math.min(currentPaidAmount, totalPayable))
  }, [totalPayable])

  const handleTotalPayableChange = (value: number) => {
    setIsPayableManuallyEdited(Math.abs(totalBilledAmount - value) > 0.009)
    setTotalPayable(value)
  }

  const buildPayload = (): InvoiceCreatePayload => ({
    customer,
    items: items.map((item) => ({
      product_id: item.product_id,
      product_code: item.product_code,
      quantity: item.quantity,
      discount_percentage: item.discount_percentage,
      discount_amount_per_unit: item.discount_amount_per_unit,
      selling_price_per_unit: item.selling_price_per_unit,
    })),
    invoice_date: invoiceDate,
    payment_status: paymentStatus,
    payment_mode: paymentMode || null,
    paid_amount: paidAmount,
    total_payable_amount: totalPayable,
    total_tax_amount: totals.tax,
    invoice_status: 'saved',
    notes,
  })

  const normalizePayload = (payload: InvoiceCreatePayload): InvoiceCreatePayload => {
    const parsed = invoiceCreateSchema.parse(payload)

    return {
      customer: {
        id: parsed.customer.id ?? null,
        first_name: parsed.customer.first_name,
        last_name: parsed.customer.last_name ?? null,
        phone: parsed.customer.phone,
        email: parsed.customer.email || null,
        address: parsed.customer.address || null,
        city: parsed.customer.city || null,
        state: parsed.customer.state || null,
        pincode: parsed.customer.pincode || null,
        gst_number: parsed.customer.gst_number || null,
      },
      items: parsed.items.map((item) => ({
        product_id: item.product_id,
        product_code: item.product_code,
        quantity: item.quantity,
        discount_percentage: item.discount_percentage,
        discount_amount_per_unit: item.discount_amount_per_unit ?? null,
        selling_price_per_unit: item.selling_price_per_unit ?? null,
      })),
      invoice_date: parsed.invoice_date ?? null,
      payment_status: parsed.payment_status,
      payment_mode: parsed.payment_mode ?? null,
      paid_amount: parsed.paid_amount,
      total_payable_amount: parsed.total_payable_amount ?? null,
      total_tax_amount: parsed.total_tax_amount,
      invoice_status: parsed.invoice_status,
      notes: parsed.notes || null,
    }
  }

  const loadInvoiceForEdit = async () => {
    if (!isEditMode || !editInvoiceId) return

    try {
      setIsLoadingInvoice(true)
      setErrorMessage('')

      const data = await billingApi.getInvoice(editInvoiceId)

      setCustomer(mapInvoiceToCustomer(data))
      setItems((data.items || []).map(mapInvoiceItemToLocalItem))

      const billedAmount = Number(data.billed_amount || data.final_amount || 0)
      const payableAmount = Number(data.final_amount || billedAmount)

      setTotalPayable(payableAmount)
      setIsPayableManuallyEdited(Math.abs(billedAmount - payableAmount) > 0.009)
      setPaidAmount(Number(data.paid_amount || 0))
      setPaymentMode((data.payment_mode as PaymentMode | null) || '')
      setPaymentStatus((data.payment_status as PaymentStatus) || 'pending')
      setNotes(data.notes || '')
      setInvoiceDate(data.invoice_date || new Date().toISOString().slice(0, 10))
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load invoice for editing'
      )
    } finally {
      setIsLoadingInvoice(false)
    }
  }

  useEffect(() => {
    loadInvoiceForEdit()
  }, [editInvoiceId])

  const saveAndPreview = async () => {
    try {
      setErrorMessage('')
      setSuccessMessage('')

      const payload = buildPayload()
      const parsed = invoiceCreateSchema.safeParse(payload)

      if (!parsed.success) {
        setErrorMessage(parsed.error.issues[0]?.message || 'Please check invoice details')
        return
      }

      setIsSaving(true)

      const normalizedPayload = normalizePayload(payload)

      const invoice =
        isEditMode && editInvoiceId
          ? await billingApi.updateInvoice(editInvoiceId, normalizedPayload)
          : await billingApi.createInvoice(normalizedPayload)

      navigate(`/billing/${invoice.id}/preview`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isEditMode
            ? 'Unable to update invoice'
            : 'Unable to create invoice'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const saveDraftLocally = () => {
    const payload = buildPayload()

    localStorage.setItem(
      'billing_invoice_draft',
      JSON.stringify({
        ...payload,
        edit_invoice_id: editInvoiceId,
      })
    )

    setSuccessMessage(
      isEditMode
        ? 'Edited invoice draft saved locally in this browser.'
        : 'Draft saved locally in this browser.'
    )
  }

  if (isLoadingInvoice) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1200px]">
          <div className="flex min-h-[520px] items-center justify-center rounded-[34px] bg-white/80 dark:bg-slate-800/80">
            <Loader2 size={34} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <style>{`
        input[type='number']::-webkit-inner-spin-button,
        input[type='number']::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type='number'] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>

      <div className="mx-auto mt-2 max-w-[1600px]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800/75 dark:text-slate-300 dark:shadow-[0_12px_30px_rgba(0,0,0,0.2)] dark:hover:text-indigo-400"
          >
            <ArrowLeft size={17} />
            Back to Billing
          </button>

          <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl dark:border-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-400">
                Billing › {isEditMode ? 'Edit Invoice' : 'New Invoice'}
              </div>

              <h1 className="text-[42px] font-black tracking-[-0.04em] text-slate-950 md:text-[56px] dark:text-white">
                {isEditMode ? 'Edit Invoice' : 'Create New Invoice'}
              </h1>

              <p className="mt-3 max-w-2xl text-[18px] leading-8 text-slate-600 dark:text-slate-400">
                {isEditMode
                  ? 'Update customer details, products, discount, and payment information for this invoice.'
                  : 'Select a customer, add products by code, apply discounts, and generate a clean invoice.'}
              </p>
            </div>

            <div className="hidden items-center gap-4 rounded-[28px] bg-white/80 p-4 shadow-[0_18px_48px_rgba(99,102,241,0.08)] backdrop-blur-xl lg:flex dark:bg-slate-800/80 dark:shadow-[0_18px_48px_rgba(0,0,0,0.2)]">
              <Step active number="1" label="Details" />
              <div className="h-px w-16 bg-slate-200 dark:bg-slate-700" />
              <Step number="2" label="Review" />
              <div className="h-px w-16 bg-slate-200 dark:bg-slate-700" />
              <Step number="3" label="Payment" />
            </div>
          </div>

          {errorMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-[24px] border border-red-100 bg-red-50 p-5 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-black">
                  {isEditMode ? 'Unable to update invoice' : 'Unable to create invoice'}
                </p>
                <p className="mt-1 text-sm">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-black">Saved</p>
                <p className="mt-1 text-sm">{successMessage}</p>
              </div>
            </div>
          )}

          <div className="grid gap-8 xl:grid-cols-[1fr_410px]">
            <div className="space-y-8">
              <CustomerSelector customer={customer} onCustomerChange={setCustomer} />
              <InvoiceItemsTable items={items} onItemsChange={setItems} />
            </div>

            <InvoiceSummaryCard
              items={items}
              totalBilledAmount={totalBilledAmount}
              totalPayable={totalPayable}
              onTotalPayableChange={handleTotalPayableChange}
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
              primaryActionLabel={
                isEditMode ? 'Update & Preview Invoice' : 'Save & Preview Invoice'
              }
              secondaryActionLabel={
                isEditMode ? 'Save Edited Draft' : 'Save Draft Locally'
              }
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
        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition-colors ${
          active
            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
        }`}
      >
        {number}
      </div>

      <span
        className={`text-sm font-black transition-colors ${
          active
            ? 'text-indigo-700 dark:text-indigo-400'
            : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
