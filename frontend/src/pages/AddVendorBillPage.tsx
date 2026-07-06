import { useEffect, useMemo, useRef, useState } from 'react'
import type { ElementType, FormEventHandler } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Banknote,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Loader2,
  ReceiptText,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react'

import { AppShell } from '../components/layout/AppShell'
import { vendorsApi } from '../features/vendors/api'
import { vendorBillSchema } from '../features/vendors/schemas'
import type { Vendor, VendorBill } from '../features/vendors/types'

const today = new Date().toISOString().slice(0, 10)
const PAYMENT_MODE_OPTIONS = [
  { value: '', label: 'Not specified', helper: 'Leave blank if not needed', icon: Sparkles },
  { value: 'cash', label: 'Cash', helper: 'Physical payment', icon: Banknote },
  { value: 'upi', label: 'UPI', helper: 'Instant transfer', icon: Smartphone },
  { value: 'bank_transfer', label: 'Bank Transfer', helper: 'Direct bank payment', icon: Building2 },
  { value: 'card', label: 'Card', helper: 'Credit or debit card', icon: CreditCard },
  { value: 'cheque', label: 'Cheque', helper: 'Cheque payment', icon: FileText },
  { value: 'other', label: 'Other', helper: 'Manual selection', icon: Sparkles },
]
const REMINDER_DAY_OPTIONS = [
  { value: '3', label: '3 Days' },
  { value: '5', label: '5 Days' },
  { value: '7', label: '7 Days' },
  { value: '15', label: '15 Days' },
  { value: '30', label: '30 Days' },
]
const emptyForm = {
  bill_number: '',
  bill_date: today,
  due_date: '',
  total_amount: '',
  paid_amount: '',
  payment_mode: '',
  payment_reference: '',
  reminder_days_before: 5,
  attachment_url: '',
  notes: '',
}

export default function AddVendorBillPage() {
  const navigate = useNavigate()
  const { vendorId, billId } = useParams()

  const id = Number(vendorId)
  const activeBillId = billId ? Number(billId) : null
  const isEditMode = !!activeBillId && !Number.isNaN(activeBillId)

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [bill, setBill] = useState<VendorBill | null>(null)
  const [form, setForm] = useState(emptyForm)

  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingBill, setIsLoadingBill] = useState(false)

  const totalAmount = Number(form.total_amount || 0)
  const paidAmount = Number(form.paid_amount || 0)

  const remainingAmount = useMemo(() => {
    return Math.max(totalAmount - paidAmount, 0)
  }, [totalAmount, paidAmount])

  const progress = useMemo(() => {
    if (totalAmount <= 0) return 0
    return Math.min(Math.round((paidAmount / totalAmount) * 100), 100)
  }, [totalAmount, paidAmount])

  useEffect(() => {
    if (!Number.isNaN(id)) {
      vendorsApi.getVendor(id).then(setVendor).catch(() => setVendor(null))
    }
  }, [id])

  useEffect(() => {
    if (!isEditMode || !activeBillId) {
      setBill(null)
      setForm(emptyForm)
      return
    }

    const loadBill = async () => {
      try {
        setIsLoadingBill(true)
        setErrorMessage('')

        const billData = await vendorsApi.getVendorBill(activeBillId)

        setBill(billData)
        setForm({
          bill_number: billData.bill_number || '',
          bill_date: billData.bill_date || today,
          due_date: billData.due_date || '',
          total_amount: String(billData.total_amount ?? ''),
          paid_amount: String(billData.paid_amount ?? ''),
          payment_mode: billData.payment_mode || '',
          payment_reference: billData.payment_reference || '',
          reminder_days_before: billData.reminder_days_before ?? 5,
          attachment_url: billData.attachment_url || '',
          notes: billData.notes || '',
        })
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load bill'
        )
      } finally {
        setIsLoadingBill(false)
      }
    }

    loadBill()
  }, [activeBillId, isEditMode])

  const updateField = (field: keyof typeof form, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()

    try {
      setErrorMessage('')

      const parsed = vendorBillSchema.safeParse(form)

      if (!parsed.success) {
        setErrorMessage(parsed.error.issues[0]?.message || 'Invalid bill data')
        return
      }

      if (isEditMode && Number(parsed.data.total_amount) < Number(form.paid_amount || 0)) {
        setErrorMessage('Total amount cannot be less than the recorded paid amount')
        return
      }

      setIsSaving(true)

      if (isEditMode && activeBillId) {
        await vendorsApi.updateVendorBill(activeBillId, {
          bill_number: parsed.data.bill_number,
          bill_date: parsed.data.bill_date,
          due_date: parsed.data.due_date,
          total_amount: parsed.data.total_amount,
          payment_mode: parsed.data.payment_mode,
          payment_reference: parsed.data.payment_reference,
          reminder_days_before: parsed.data.reminder_days_before,
          attachment_url: parsed.data.attachment_url,
          notes: parsed.data.notes,
        })
      } else {
        await vendorsApi.createVendorBill(id, {
          bill_number: parsed.data.bill_number,
          bill_date: parsed.data.bill_date,
          due_date: parsed.data.due_date,
          total_amount: parsed.data.total_amount,
          paid_amount: parsed.data.paid_amount,
          payment_mode: parsed.data.payment_mode,
          payment_reference: parsed.data.payment_reference,
          reminder_days_before: parsed.data.reminder_days_before,
          attachment_url: parsed.data.attachment_url,
          notes: parsed.data.notes,
        })
      }

      navigate(`/vendors/${id}`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isEditMode
            ? 'Unable to update bill'
            : 'Unable to create bill'
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingBill) {
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
        input[data-hide-number-spinner='true']::-webkit-inner-spin-button,
        input[data-hide-number-spinner='true']::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[data-hide-number-spinner='true'] {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>

      <div className="mx-auto max-w-[1600px]">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate(`/vendors/${id}`)}
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700
            dark:border-indigo-900/50 dark:bg-slate-800/75 dark:text-slate-200 dark:hover:text-indigo-400"
        >
          <ArrowLeft size={17} />
          Back to Vendor
        </button>

        {/* Page header */}
        <div className="mb-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl
            dark:border-indigo-900/50 dark:bg-slate-800/70 dark:text-indigo-400">
            <ReceiptText size={15} />
            {isEditMode ? 'Edit Transaction' : 'New Transaction'}
          </div>

          <h1 className="text-[42px] font-black tracking-[-0.05em] text-slate-950 md:text-[60px] dark:text-white">
            {isEditMode ? 'Edit Vendor Bill' : 'Add New Bill'}
          </h1>

          <p className="mt-3 max-w-2xl text-[18px] leading-8 text-slate-600 dark:text-slate-400">
            {isEditMode
              ? 'Update the bill details carefully. Paid amount stays aligned with recorded payments.'
              : 'Register a vendor invoice, define due date, and configure payment alerts. Remaining amount updates in real time.'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-8 xl:grid-cols-[1fr_410px]"
        >
          {/* ── Main card ── */}
          <div className="rounded-[34px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl md:p-8
            dark:bg-slate-900/80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
            {errorMessage && (
              <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700
                dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Bill Number"
                value={form.bill_number}
                onChange={(value) => updateField('bill_number', value)}
                placeholder="INV-2026-001"
              />

              <Input
                type="date"
                label="Bill Date"
                value={form.bill_date}
                onChange={(value) => updateField('bill_date', value)}
              />

              <Input
                type="number"
                label="Total Bill Amount"
                value={form.total_amount}
                onChange={(value) => updateField('total_amount', value)}
                placeholder="0.00"
              />

              <Input
                type="number"
                label={isEditMode ? 'Recorded Paid Amount' : 'Initial Paid Amount'}
                value={form.paid_amount}
                onChange={(value) => updateField('paid_amount', value)}
                placeholder="0.00"
                disabled={isEditMode}
                helper={
                  isEditMode
                    ? 'Use Add Payment from the bill ledger to change paid amount.'
                    : undefined
                }
              />
            </div>

            <SoftDivider />

            <Input
              type="date"
              label="Payment Due Date"
              value={form.due_date}
              onChange={(value) => updateField('due_date', value)}
            />

            <SoftDivider />

            {/* Reminder section header */}
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600
                dark:bg-indigo-950/60 dark:text-indigo-400">
                <BellRing size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                  Payment Reminder
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Choose when the system should alert you.
                </p>
              </div>
            </div>

            {/* Reminder box */}
            <div className="rounded-[26px] bg-slate-50/90 p-5 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.06)]
              dark:bg-slate-800/80 dark:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.10)]">
              <div className="grid gap-5 md:grid-cols-[1fr_190px] md:items-center">
                <div>
                  <p className="font-black text-slate-950 dark:text-white">
                    Send notification in advance
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Configure how many days before the due date you want to be
                    alerted.
                  </p>
                </div>

                <DropdownField
                  label="Reminder"
                  value={String(form.reminder_days_before)}
                  options={REMINDER_DAY_OPTIONS}
                  onChange={(value) => updateField('reminder_days_before', Number(value))}
                />
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <PaymentModeField
                value={form.payment_mode}
                onChange={(value) => updateField('payment_mode', value)}
              />

              <Input
                label="Payment Reference"
                value={form.payment_reference}
                onChange={(value) => updateField('payment_reference', value)}
                placeholder="Optional reference"
              />
            </div>

            {/* Notes */}
            <label className="mt-8 block space-y-2">
              <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={4}
                placeholder="Internal bill notes"
                className="w-full resize-none rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 py-3 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]
                  dark:border-indigo-800/40 dark:bg-slate-800/90 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-indigo-600 dark:focus:bg-slate-800 dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.08)]"
              />
            </label>

            {/* Action buttons */}
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -2 }}
                type="submit"
                disabled={isSaving}
                className="inline-flex h-14 flex-1 items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#3b2be4] text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {isEditMode ? 'Save Bill Changes' : 'Create Bill Entry'}
              </motion.button>

              <button
                type="button"
                onClick={() => navigate(`/vendors/${id}`)}
                className="h-14 rounded-[22px] bg-slate-100 px-8 text-sm font-black text-slate-800 transition hover:bg-slate-200
                  dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-6">
            {/* Real-time calculation card — gradient stays as-is */}
            <div className="rounded-[34px] bg-gradient-to-br from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] p-7 text-white shadow-[0_28px_70px_rgba(79,70,229,0.30)]">
              <p className="mb-8 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
                <CalendarDays size={15} />
                Real-time Calculation
              </p>

              <p className="text-sm text-white/70">Current Status</p>

              <div className="mt-2 inline-flex rounded-full bg-white/18 px-4 py-2 text-xs font-black uppercase">
                {bill?.status || 'Draft'}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-5">
                <div>
                  <p className="text-sm text-white/70">Remaining</p>
                  <h3 className="mt-2 text-3xl font-black">
                    ₹{remainingAmount.toLocaleString('en-IN')}
                  </h3>
                </div>

                <div>
                  <p className="text-sm text-white/70">Progress</p>
                  <h3 className="mt-2 text-3xl font-black">{progress}%</h3>
                </div>
              </div>

              <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/18">
                <motion.div
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35 }}
                  className="h-full rounded-full bg-white"
                />
              </div>
            </div>

            {/* Active Vendor card */}
            <div className="rounded-[30px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl
              dark:bg-slate-900/80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
              <p className="mb-4 flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
                <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
                Active Vendor
              </p>

              <div className="flex items-center gap-4 rounded-[24px] bg-slate-50/90 p-4
                dark:bg-slate-800/80">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600
                  dark:bg-indigo-950/60 dark:text-indigo-400">
                  <FileText size={22} />
                </div>

                <div>
                  <p className="font-black text-slate-950 dark:text-white">
                    {vendor?.company_name || vendor?.vendor_name || 'Vendor'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Supply Partner</p>
                </div>
              </div>
            </div>

            {/* Pro tip card */}
            <div className="rounded-[30px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl
              dark:bg-slate-900/80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600
                dark:bg-indigo-950/60 dark:text-indigo-400">
                <Sparkles size={22} />
              </div>
              <h3 className="text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                Pro Tip: Automated Reconciliation
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {isEditMode
                  ? 'Edit core bill details here. To preserve payment history, add new collections from the vendor ledger instead of changing paid amount manually.'
                  : 'Set the initial paid amount correctly. Veltrix will calculate remaining balance and payment status automatically.'}
              </p>
            </div>
          </aside>
        </form>
      </div>
    </AppShell>
  )
}

function SoftDivider() {
  return (
    <div className="my-8 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
  )
}

function DropdownField({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return

    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      <span className="block text-[12px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-14 w-full items-center justify-between rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 text-left text-[15px] outline-none transition-all duration-300 ${
          open
            ? 'border-indigo-300 bg-white shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:border-indigo-600 dark:bg-slate-800 dark:shadow-[0_0_0_5px_rgba(99,102,241,0.08)]'
            : 'dark:border-indigo-800/40 dark:bg-slate-800/90'
        }`}
      >
        <span className={selected ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>
          {selected?.label || placeholder || 'Select'}
        </span>
        <ChevronDown
          size={18}
          className={`text-indigo-500 transition-transform duration-300 dark:text-indigo-400 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[20px] border border-indigo-100/80 bg-white/98 p-2 shadow-[0_24px_60px_rgba(99,102,241,0.14)] backdrop-blur-xl dark:border-indigo-800/40 dark:bg-slate-900/98 dark:shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
          {options.map((option) => {
            const active = option.value === value

            return (
              <button
                key={`${label}-${option.value || 'empty'}`}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-[15px] transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-indigo-50 to-violet-50 font-black text-indigo-700 dark:from-indigo-950 dark:to-violet-950 dark:text-indigo-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>{option.label}</span>
                {active && <Check size={16} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PaymentModeField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const selected = PAYMENT_MODE_OPTIONS.find((option) => option.value === value) || PAYMENT_MODE_OPTIONS[0]
  const SelectedIcon = selected.icon

  useEffect(() => {
    if (!open) return

    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={wrapperRef} className="relative space-y-2">
      <span className="block text-[12px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
        Payment Mode
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-14 w-full items-center justify-between rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 text-left outline-none transition-all duration-300 ${
          open
            ? 'border-indigo-300 bg-white shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:border-indigo-600 dark:bg-slate-800 dark:shadow-[0_0_0_5px_rgba(99,102,241,0.08)]'
            : 'dark:border-indigo-800/40 dark:bg-slate-800/90'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] dark:from-indigo-950 dark:to-violet-950 dark:text-indigo-400">
            <SelectedIcon size={16} />
          </div>
          <div>
            <p className="text-[14px] font-black text-slate-800 dark:text-slate-100">
              {selected.label}
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {selected.helper}
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-indigo-500 transition-transform duration-300 dark:text-indigo-400 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[20px] border border-indigo-100/80 bg-white/98 p-2 shadow-[0_22px_54px_rgba(99,102,241,0.16)] backdrop-blur-xl dark:border-indigo-800/40 dark:bg-slate-900/98 dark:shadow-[0_22px_54px_rgba(0,0,0,0.34)]">
          <div className="space-y-1">
            {PAYMENT_MODE_OPTIONS.map((option) => {
              const active = option.value === value
              const Icon = option.icon as ElementType

              return (
                <button
                  key={`payment-mode-${option.value || 'empty'}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 ${
                    active
                      ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-700 shadow-[0_12px_30px_rgba(99,102,241,0.12)] dark:border-indigo-700 dark:from-indigo-950 dark:to-violet-950 dark:text-indigo-300'
                      : 'border-slate-100 bg-slate-50/85 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/60'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    active
                      ? 'bg-white/70 text-indigo-600 dark:bg-slate-900/80 dark:text-indigo-300'
                      : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black">{option.label}</p>
                    <p className="mt-0.5 text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">
                      {option.helper}
                    </p>
                  </div>
                  {active && <Check size={16} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Input({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
  disabled = false,
  helper,
}: {
  label: string
  value: string | number
  placeholder?: string
  type?: string
  disabled?: boolean
  helper?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
        {label}
      </span>

      <input
        type={type}
        data-hide-number-spinner={type === 'number' ? 'true' : undefined}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500
          dark:border-indigo-800/40 dark:bg-slate-800/90 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-indigo-600 dark:focus:bg-slate-800 dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.08)] dark:disabled:bg-slate-800/70 dark:disabled:text-slate-400"
      />
      {helper && (
        <span className="block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
          {helper}
        </span>
      )}
    </label>
  )
}
