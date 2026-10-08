import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, PlusCircle, Printer } from 'lucide-react'

import CustomerSelector from '../components/billing/CustomerSelector'
import InvoiceItemsTable from '../components/billing/InvoiceItemsTable'
import InvoiceSummaryCard from '../components/billing/InvoiceSummaryCard'
import type { ProductCodeSearchHandle } from '../components/billing/ProductCodeSearch'
import { useToast } from '../components/ui/ToastProvider'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { billingApi } from '../features/billing/api'
import { calculateGstPreview } from '../features/billing/gstPreview'
import { invoiceCreateSchema } from '../features/billing/schemas'
import type {
  CustomerPayload,
  Invoice,
  InvoiceCreatePayload,
  InvoicePaymentInput,
  LocalInvoiceItem,
  LocalPaymentLine,
  PaymentMode,
  PaymentStatus,
} from '../features/billing/types'
import { useBranchDirtyGuard } from '../hooks/useBranchDirtyGuard'
import { useBranchOperation, type BranchOperationSnapshot } from '../hooks/useBranchOperation'
import {
  discardQuarantinedLegacyPosDraft,
  hasQuarantinedLegacyPosDraft,
  loadPosDraft,
  migrateLegacyPosDraft,
  removePosDraft,
  savePosDraft,
  type PosDraftData,
} from '../lib/pos-drafts'

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
    hsn_sac: item.hsn_sac_snapshot || '',
    mrp: Number(item.mrp || 0),
    buy_price: Number(item.buy_price || 0),
    available_stock: Number(item.quantity || 0),
    gst_rate: Number(item.gst_rate || 0),
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

function createInvoiceRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `invoice-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createPaymentLine(amount = 0, payment_method: LocalPaymentLine['payment_method'] = 'cash'): LocalPaymentLine {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    amount,
    payment_method,
    payment_reference: '',
    notes: '',
  }
}

function friendlyInvoiceError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('insufficient stock') || normalized.includes('stock')) {
    return message || 'Insufficient stock for one or more products.'
  }
  if (normalized.includes('idempotency') || normalized.includes('request key') || normalized.includes('already used')) {
    return 'This save request was already processed differently. Start a new sale and try again.'
  }
  if (normalized.includes('gst') || normalized.includes('state')) {
    return message || 'GST details are incomplete. Check shop/customer state and GST fields.'
  }
  if (normalized.includes('payment') || normalized.includes('remaining')) {
    return message || 'Payment allocation is invalid. Check paid and remaining amount.'
  }
  if (normalized.includes('network') || normalized.includes('failed to fetch')) {
    return 'Network problem while saving. Please retry; the same request key will be reused safely.'
  }
  return message
}

export default function CreateInvoicePage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { activeShop: shop, branches, selectedBranchId } = useBranch()
  const { captureBranchOperation, isCurrentBranchOperation } = useBranchOperation()
  const [searchParams] = useSearchParams()

  const editParam = searchParams.get('edit')
  const editInvoiceId = editParam ? Number(editParam) : null
  const isEditMode = !!editInvoiceId && !Number.isNaN(editInvoiceId)

  const [customer, setCustomer] = useState<CustomerPayload>(emptyCustomer)
  const [items, setItems] = useState<LocalInvoiceItem[]>([])

  const [paymentLines, setPaymentLines] = useState<LocalPaymentLine[]>([createPaymentLine()])
  const [totalPayable, setTotalPayable] = useState(0)
  const [isPayableManuallyEdited, setIsPayableManuallyEdited] = useState(false)

  const [notes, setNotes] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))

  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false)
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null)
  const invoiceRequestIdRef = useRef(createInvoiceRequestId())
  const draftRevisionRef = useRef<number | null>(null)
  const restoredDraftRef = useRef(false)
  const productSearchRef = useRef<ProductCodeSearchHandle | null>(null)
  const [legacyDraftQuarantined, setLegacyDraftQuarantined] = useState(false)

  const totalBilledAmount = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + Number(item.total_selling_price || 0),
      0
    )
  }, [items])

  const gstPreview = useMemo(
    () =>
      calculateGstPreview({
        shop,
        customer,
        items,
        taxablePayableAmount: totalPayable,
      }),
    [customer, items, shop, totalPayable],
  )

  useEffect(() => {
    setTotalPayable((currentTotalPayable) => {
      if (!isPayableManuallyEdited) {
        return totalBilledAmount
      }

      return Math.min(currentTotalPayable, totalBilledAmount)
    })
  }, [isPayableManuallyEdited, totalBilledAmount])

  useEffect(() => {
    setPaymentLines((currentLines) => {
      let remaining = gstPreview.grandTotal
      return currentLines.map((line) => {
        const nextAmount = Math.min(Math.max(Number(line.amount || 0), 0), Math.max(remaining, 0))
        remaining -= nextAmount
        return { ...line, amount: nextAmount }
      })
    })
  }, [gstPreview.grandTotal])

  const draftIdentity = user?.id && user.organization_id && selectedBranchId
    ? { userId: user.id, organizationId: user.organization_id, branchId: selectedBranchId }
    : null

  const currentDraftData = (): PosDraftData => ({
    customer,
    items,
    totalPayable,
    isPayableManuallyEdited,
    notes,
    invoiceDate,
    editInvoiceId,
    clientRequestId: invoiceRequestIdRef.current,
  })

  const hasUnsavedWork = !completedInvoice && (
    items.length > 0 ||
    Boolean(customer.first_name || customer.last_name || customer.phone || customer.email || customer.address) ||
    Boolean(notes.trim()) ||
    paymentLines.some((line) => Number(line.amount || 0) > 0 || Boolean(line.payment_reference || line.notes))
  )

  const resetSaleState = (removeStoredDraft: boolean) => {
    if (removeStoredDraft && draftIdentity) {
      removePosDraft(draftIdentity.userId, draftIdentity.organizationId, draftIdentity.branchId)
      draftRevisionRef.current = null
    }
    restoredDraftRef.current = false
    setCompletedInvoice(null)
    setCustomer(emptyCustomer)
    setItems([])
    setPaymentLines([createPaymentLine()])
    setTotalPayable(0)
    setIsPayableManuallyEdited(false)
    setNotes('')
    setInvoiceDate(new Date().toISOString().slice(0, 10))
    setErrorMessage('')
    invoiceRequestIdRef.current = createInvoiceRequestId()
  }

  const persistDraft = () => {
    if (!draftIdentity) throw new Error('Select an active branch before saving this draft.')
    const saved = savePosDraft(draftIdentity, currentDraftData(), draftRevisionRef.current)
    draftRevisionRef.current = saved.revision
  }

  useBranchDirtyGuard('pos-invoice', {
    dirty: hasUnsavedWork,
    label: isEditMode ? 'Invoice edits' : 'POS sale',
    message: 'The cart, customer, and tender details belong to the current branch.',
    discard: () => resetSaleState(true),
    saveDraft: () => {
      persistDraft()
      resetSaleState(false)
    },
  })

  useEffect(() => {
    if (isEditMode || !draftIdentity || !branches.length) return
    let cancelled = false

    const restore = async () => {
      const migration = migrateLegacyPosDraft(
        { userId: draftIdentity.userId, organizationId: draftIdentity.organizationId },
        branches.map((branch) => branch.id),
      )
      setLegacyDraftQuarantined(migration.quarantined || hasQuarantinedLegacyPosDraft())

      const draft = loadPosDraft(draftIdentity.userId, draftIdentity.organizationId, draftIdentity.branchId)
      if (!draft) {
        draftRevisionRef.current = null
        return
      }

      try {
        const products = await Promise.all(
          draft.data.items.map((item) => billingApi.getBillingProductByCode(item.product_code)),
        )
        const referencesValid = products.every((product, index) => (
          product.id === draft.data.items[index]?.product_id && product.is_active
        ))
        if (!referencesValid) throw new Error('A saved product is no longer available in this branch.')
        if (cancelled) return

        const hydratedItems = draft.data.items.map((item, index) => {
          const product = products[index]
          const quantity = Number(item.quantity || 0)
          const mrp = Number(product.mrp || 0)
          const buyPrice = Number(product.buying_price || 0)
          const sellingPrice = Number(item.selling_price_per_unit || product.selling_price || mrp)
          const discountPerUnit = Number(item.discount_amount_per_unit || Math.max(mrp - sellingPrice, 0))
          return {
            ...item,
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.name,
            category: product.category || '',
            unit: product.unit || '',
            hsn_sac: product.hsn_sac || '',
            mrp,
            buy_price: buyPrice,
            available_stock: Number(product.available_stock || 0),
            gst_rate: Number(product.gst_rate || 0),
            discount_amount_per_unit: discountPerUnit,
            selling_price_per_unit: sellingPrice,
            total_discount_amount: discountPerUnit * quantity,
            total_selling_price: sellingPrice * quantity,
            total_buy_cost: buyPrice * quantity,
            profit_per_unit: sellingPrice - buyPrice,
            total_profit: (sellingPrice - buyPrice) * quantity,
          }
        })

        setCustomer({ ...draft.data.customer, id: null })
        setItems(hydratedItems)
        setPaymentLines([createPaymentLine()])
        setTotalPayable(draft.data.totalPayable)
        setIsPayableManuallyEdited(draft.data.isPayableManuallyEdited)
        setNotes(draft.data.notes)
        setInvoiceDate(draft.data.invoiceDate)
        invoiceRequestIdRef.current = draft.data.clientRequestId || createInvoiceRequestId()
        draftRevisionRef.current = draft.revision
        restoredDraftRef.current = true
        showToast({
          title: 'Branch draft restored',
          message: 'Payment details were cleared and must be entered again.',
          variant: 'success',
        })
      } catch (error) {
        if (cancelled) return
        removePosDraft(draftIdentity.userId, draftIdentity.organizationId, draftIdentity.branchId)
        draftRevisionRef.current = null
        showToast({
          title: 'Draft could not be restored',
          message: error instanceof Error ? error.message : 'The saved draft is invalid for this branch.',
          variant: 'error',
        })
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [branches, draftIdentity?.branchId, draftIdentity?.organizationId, draftIdentity?.userId, isEditMode])

  const handleTotalPayableChange = (value: number) => {
    setIsPayableManuallyEdited(Math.abs(totalBilledAmount - value) > 0.009)
    setTotalPayable(value)
  }

  const derivePaymentSummary = () => {
    const activePayments: InvoicePaymentInput[] = paymentLines
      .filter((line) => Number(line.amount || 0) > 0)
      .map((line) => ({
        amount: Number(line.amount || 0),
        payment_method: line.payment_method,
        payment_reference: line.payment_reference || null,
        notes: line.notes || null,
      }))
    const paidAmount = activePayments.reduce((sum, payment) => sum + payment.amount, 0)
    const remainingAmount = Math.max(gstPreview.grandTotal - paidAmount, 0)
    const methods = Array.from(new Set(activePayments.map((payment) => payment.payment_method)))
    const paymentMode: PaymentMode | null =
      activePayments.length === 0 ? null : methods.length === 1 ? methods[0] : 'mixed'
    const paymentStatus: PaymentStatus =
      paidAmount <= 0 ? 'pending' : remainingAmount > 0 ? 'partial' : 'paid'

    return { activePayments, paidAmount, paymentMode, paymentStatus }
  }

  const buildPayload = (): InvoiceCreatePayload => {
    const paymentSummary = derivePaymentSummary()
    return {
      client_request_id: isEditMode ? null : invoiceRequestIdRef.current,
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
      payment_status: paymentSummary.paymentStatus,
      payment_mode: paymentSummary.paymentMode,
      paid_amount: paymentSummary.paidAmount,
      payments: paymentSummary.activePayments,
      total_payable_amount: totalPayable,
      total_tax_amount: gstPreview.totalTaxAmount,
      invoice_status: 'saved',
      notes,
    }
  }

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
      client_request_id: parsed.client_request_id ?? null,
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
      payments: (parsed.payments ?? []).map((payment) => ({
        amount: Number(payment.amount || 0),
        payment_method: payment.payment_method,
        payment_reference: payment.payment_reference || null,
        notes: payment.notes || null,
        received_at: payment.received_at || null,
      })),
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

      const billedAmount = (data.items || []).reduce(
        (sum, item) => sum + Number(item.total_selling_price || 0),
        0,
      )
      const snapshotTaxableAmount = (data.items || []).reduce(
        (sum, item) => sum + Number(item.taxable_value || 0),
        0,
      )
      const payableAmount =
        snapshotTaxableAmount > 0
          ? snapshotTaxableAmount
          : Number(data.final_amount || billedAmount)

      setTotalPayable(payableAmount)
      setIsPayableManuallyEdited(Math.abs(billedAmount - payableAmount) > 0.009)
      const existingPayments =
        data.payments && data.payments.length
          ? data.payments.map((payment) => ({
              id: String(payment.id),
              amount: Number(payment.amount || 0),
              payment_method: payment.payment_method,
              payment_reference: payment.payment_reference || '',
              notes: payment.notes || '',
            }))
          : [createPaymentLine(Number(data.paid_amount || 0), (data.payment_mode === 'mixed' ? 'cash' : data.payment_mode) || 'cash')]
      setPaymentLines(existingPayments)
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
    if (isSaving) return
    if (completedInvoice && !isEditMode) {
      showToast({
        title: 'Sale already saved',
        message: 'Use New Sale to start another bill.',
        variant: 'success',
      })
      return
    }

    let operation: BranchOperationSnapshot | null = null
    try {
      setErrorMessage('')

      if (restoredDraftRef.current) {
        const products = await Promise.all(items.map((item) => billingApi.getBillingProductByCode(item.product_code)))
        const invalidProduct = products.find((product, index) => (
          product.id !== items[index]?.product_id || !product.is_active
        ))
        if (invalidProduct) {
          throw new Error('A restored product no longer belongs to this branch. Remove it and add it again.')
        }
      }

      const payload = buildPayload()
      const parsed = invoiceCreateSchema.safeParse(payload)

      if (!parsed.success) {
        showToast({
          title: 'Please check invoice details',
          message: parsed.error.issues[0]?.message || 'Please check invoice details',
          variant: 'error',
        })
        return
      }

      setIsSaving(true)
      operation = captureBranchOperation()

      const normalizedPayload = normalizePayload(payload)

      const invoice =
        isEditMode && editInvoiceId
          ? await billingApi.updateInvoice(editInvoiceId, normalizedPayload)
          : await billingApi.createInvoice(normalizedPayload)

      if (!isCurrentBranchOperation(operation)) return

      if (!isEditMode) {
        if (draftIdentity) removePosDraft(draftIdentity.userId, draftIdentity.organizationId, operation.branchId)
        draftRevisionRef.current = null
        restoredDraftRef.current = false
        invoiceRequestIdRef.current = createInvoiceRequestId()
        setCompletedInvoice(invoice)
        showToast({
          title: 'Sale saved',
          message: `Invoice ${invoice.invoice_number} is ready.`,
          variant: 'success',
        })
        return
      }

      navigate(`/billing/${invoice.id}/preview`)
    } catch (error) {
      if (operation && !isCurrentBranchOperation(operation)) return
      showToast({
        title: isEditMode ? 'Unable to update invoice' : 'Unable to create invoice',
        message:
          error instanceof Error
            ? friendlyInvoiceError(error.message)
            : isEditMode
              ? 'Unable to update invoice'
              : 'Unable to create invoice',
        variant: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const startNewSale = () => {
    resetSaleState(true)
    window.setTimeout(() => productSearchRef.current?.focus(), 100)
  }

  const saveDraftLocally = () => {
    try {
      persistDraft()
      showToast({
        title: 'Draft saved',
        message: isEditMode
          ? 'Edited invoice draft saved for this branch in this browser.'
          : 'Draft saved for this branch in this browser.',
        variant: 'success',
      })
    } catch (error) {
      showToast({
        title: 'Draft not saved',
        message: error instanceof Error ? error.message : 'Unable to save this branch draft.',
        variant: 'error',
      })
    }
  }

  if (isLoadingInvoice) {
    return (
        <div className="mx-auto max-w-[1200px]">
          <div className="flex min-h-[520px] items-center justify-center rounded-[34px] bg-white/80 dark:bg-slate-800/80">
            <Loader2 size={34} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
    )
  }

  return (
    <>
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

          {legacyDraftQuarantined && (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold">
                An older browser draft was not restored because its branch ownership could not be verified.
              </p>
              <button
                type="button"
                onClick={() => {
                  discardQuarantinedLegacyPosDraft()
                  setLegacyDraftQuarantined(false)
                }}
                className="min-h-11 shrink-0 rounded-lg border border-amber-300 px-4 text-sm font-black dark:border-amber-800"
              >
                Discard old draft
              </button>
            </div>
          )}

          {completedInvoice && !isEditMode && (
            <div className="mb-6 rounded-[30px] border border-emerald-200 bg-emerald-50 p-5 shadow-[0_18px_44px_rgba(16,185,129,0.12)] dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-950 dark:text-white">
                      Sale completed
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      Invoice {completedInvoice.invoice_number} saved. Stock, payments, GST, and audit records are updated.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/billing/${completedInvoice.id}/preview`)}
                    className="h-11 rounded-2xl bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
                  >
                    View Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/billing/${completedInvoice.id}/preview?print=true`)}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                  >
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    type="button"
                    data-testid="new-sale-button"
                    onClick={startNewSale}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700"
                  >
                    <PlusCircle size={16} />
                    New Sale
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-8 xl:grid-cols-[1fr_410px]">
            <div className="space-y-8">
              <CustomerSelector customer={customer} onCustomerChange={setCustomer} />
              <InvoiceItemsTable items={items} onItemsChange={setItems} searchRef={productSearchRef} />
            </div>

            <InvoiceSummaryCard
              items={items}
              totalBilledAmount={totalBilledAmount}
              totalPayable={totalPayable}
              taxPreview={gstPreview}
              onTotalPayableChange={handleTotalPayableChange}
              paymentLines={paymentLines}
              onPaymentLinesChange={setPaymentLines}
              notes={notes}
              onNotesChange={setNotes}
              onPreview={saveAndPreview}
              onSaveDraft={saveDraftLocally}
              loading={isSaving}
              disabled={!!completedInvoice && !isEditMode}
              primaryActionLabel={
                completedInvoice && !isEditMode
                  ? 'Sale Completed'
                  : isEditMode
                    ? 'Update & Preview Invoice'
                    : 'Save & Preview Invoice'
              }
              secondaryActionLabel={
                isEditMode ? 'Save Edited Draft' : 'Save Draft Locally'
              }
            />
          </div>
        </motion.div>
      </div>
    </>
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





