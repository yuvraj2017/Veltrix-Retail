import { useEffect, useMemo, useState } from 'react'
import type { FormEventHandler } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BellRing,
  CalendarDays,
  FileText,
  Loader2,
  ReceiptText,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { AppShell } from '../components/layout/AppShell'
import { vendorsApi } from '../features/vendors/api'
import { vendorBillSchema } from '../features/vendors/schemas'
import type { Vendor } from '../features/vendors/types'

const today = new Date().toISOString().slice(0, 10)

export default function AddVendorBillPage() {
  const navigate = useNavigate()
  const { vendorId } = useParams()

  const id = Number(vendorId)

  const [vendor, setVendor] = useState<Vendor | null>(null)

  const [form, setForm] = useState({
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
  })

  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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

      setIsSaving(true)

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

      navigate(`/vendors/${id}`)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create bill'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px]">
        <button
          type="button"
          onClick={() => navigate(`/vendors/${id}`)}
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-indigo-100 bg-white/75 px-4 py-2.5 text-sm font-black text-slate-700 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-[1px] hover:text-indigo-700"
        >
          <ArrowLeft size={17} />
          Back to Vendor
        </button>

        <div className="mb-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-600 shadow-[0_12px_30px_rgba(99,102,241,0.08)] backdrop-blur-xl">
            <ReceiptText size={15} />
            New Transaction
          </div>

          <h1 className="text-[42px] font-black tracking-[-0.05em] text-slate-950 md:text-[60px]">
            Add New Bill
          </h1>

          <p className="mt-3 max-w-2xl text-[18px] leading-8 text-slate-600">
            Register a vendor invoice, define due date, and configure payment
            alerts. Remaining amount updates in real time.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-8 xl:grid-cols-[1fr_410px]"
        >
          <div className="rounded-[34px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl md:p-8">
            {errorMessage && (
              <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
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
                label="Initial Paid Amount"
                value={form.paid_amount}
                onChange={(value) => updateField('paid_amount', value)}
                placeholder="0.00"
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

            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <BellRing size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em]">
                  Payment Reminder
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose when the system should alert you.
                </p>
              </div>
            </div>

            <div className="rounded-[26px] bg-slate-50/90 p-5 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.06)]">
              <div className="grid gap-5 md:grid-cols-[1fr_190px] md:items-center">
                <div>
                  <p className="font-black text-slate-950">
                    Send notification in advance
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Configure how many days before the due date you want to be
                    alerted.
                  </p>
                </div>

                <select
                  value={form.reminder_days_before}
                  onChange={(event) =>
                    updateField(
                      'reminder_days_before',
                      Number(event.target.value)
                    )
                  }
                  className="rounded-[18px] border border-indigo-100 bg-white px-4 py-3 text-sm font-black text-indigo-700 outline-none transition-all duration-300 focus:border-indigo-300 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
                >
                  <option value={3}>3 Days</option>
                  <option value={5}>5 Days</option>
                  <option value={7}>7 Days</option>
                  <option value={15}>15 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <Input
                label="Payment Mode"
                value={form.payment_mode}
                onChange={(value) => updateField('payment_mode', value)}
                placeholder="Cash / UPI / Bank"
              />

              <Input
                label="Payment Reference"
                value={form.payment_reference}
                onChange={(value) => updateField('payment_reference', value)}
                placeholder="Optional reference"
              />
            </div>

            <label className="mt-8 block space-y-2">
              <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={4}
                placeholder="Internal bill notes"
                className="w-full resize-none rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 py-3 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
              />
            </label>

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
                Create Bill Entry
              </motion.button>

              <button
                type="button"
                onClick={() => navigate(`/vendors/${id}`)}
                className="h-14 rounded-[22px] bg-slate-100 px-8 text-sm font-black text-slate-800 transition hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[34px] bg-gradient-to-br from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] p-7 text-white shadow-[0_28px_70px_rgba(79,70,229,0.30)]">
              <p className="mb-8 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
                <CalendarDays size={15} />
                Real-time Calculation
              </p>

              <p className="text-sm text-white/70">Current Status</p>

              <div className="mt-2 inline-flex rounded-full bg-white/18 px-4 py-2 text-xs font-black uppercase">
                Draft
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

            <div className="rounded-[30px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl">
              <p className="mb-4 flex items-center gap-2 text-sm font-black">
                <ShieldCheck size={18} className="text-indigo-600" />
                Active Vendor
              </p>

              <div className="flex items-center gap-4 rounded-[24px] bg-slate-50/90 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <FileText size={22} />
                </div>

                <div>
                  <p className="font-black text-slate-950">
                    {vendor?.company_name || vendor?.vendor_name || 'Vendor'}
                  </p>
                  <p className="text-sm text-slate-500">Supply Partner</p>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] bg-white/78 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Sparkles size={22} />
              </div>
              <h3 className="text-xl font-black tracking-[-0.03em]">
                Pro Tip: Automated Reconciliation
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Set the initial paid amount correctly. Veltrix will calculate
                remaining balance and payment status automatically.
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
    <div className="my-8 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
  )
}

function Input({
  label,
  value,
  placeholder,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | number
  placeholder?: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-[20px] border border-indigo-100/80 bg-slate-50/90 px-4 text-[15px] text-slate-800 outline-none transition-all duration-300 placeholder:text-slate-400 focus:-translate-y-[1px] focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)]"
      />
    </label>
  )
}