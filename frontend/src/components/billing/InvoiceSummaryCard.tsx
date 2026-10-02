import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import {
  Eye,
  FileCheck2,
  Info,
  Loader2,
  Plus,
  Save,
  Trash2,
  WalletCards,
} from 'lucide-react'

import type {
  LocalInvoiceItem,
  LocalPaymentLine,
  PaymentMethod,
} from '../../features/billing/types'
import type { GstPreview } from '../../features/billing/gstPreview'

type InvoiceSummaryCardProps = {
  items: LocalInvoiceItem[]
  totalBilledAmount: number
  totalPayable: number
  taxPreview: GstPreview
  onTotalPayableChange: (value: number) => void
  paymentLines: LocalPaymentLine[]
  onPaymentLinesChange: (value: LocalPaymentLine[]) => void
  notes: string
  onNotesChange: (value: string) => void
  onPreview: () => void
  onSaveDraft: () => void
  loading?: boolean
  disabled?: boolean
  primaryActionLabel?: string
  secondaryActionLabel?: string
}

const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

const money = (value: number | string) => {
  return Number(value || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

const getNumberInputValue = (value: number) => (value === 0 ? '' : value)

const newPaymentLine = (): LocalPaymentLine => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  amount: 0,
  payment_method: 'cash',
  payment_reference: '',
  notes: '',
})

export default function InvoiceSummaryCard({
  items,
  totalBilledAmount,
  totalPayable,
  taxPreview,
  onTotalPayableChange,
  paymentLines,
  onPaymentLinesChange,
  notes,
  onNotesChange,
  onPreview,
  onSaveDraft,
  loading = false,
  disabled = false,
  primaryActionLabel = 'Save & Preview Invoice',
  secondaryActionLabel = 'Save Draft Locally',
}: InvoiceSummaryCardProps) {
  const subtotal = items.reduce((sum, item) => sum + item.mrp * item.quantity, 0)
  const itemDiscountTotal = items.reduce(
    (sum, item) => sum + item.total_discount_amount,
    0,
  )
  const extraDiscountAmount = Math.max(totalBilledAmount - totalPayable, 0)
  const discountTotal = itemDiscountTotal + extraDiscountAmount
  const paidAmount = paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0)
  const remainingAmount = Math.max(taxPreview.grandTotal - paidAmount, 0)
  const [cashTendered, setCashTendered] = useState(0)
  const cashApplied = paymentLines
    .filter((line) => line.payment_method === 'cash')
    .reduce((sum, line) => sum + Number(line.amount || 0), 0)
  const changeDue = Math.max(cashTendered - cashApplied, 0)
  const hasCashPayment = cashApplied > 0 || paymentLines.some((line) => line.payment_method === 'cash')
  const paymentIntent = useMemo(() => {
    if (paidAmount <= 0) return 'unpaid'
    if (remainingAmount <= 0 && paymentLines.filter((line) => Number(line.amount || 0) > 0).length > 1) return 'split'
    if (remainingAmount <= 0) return 'full'
    return 'partial'
  }, [paidAmount, paymentLines, remainingAmount])

  const updatePaymentLine = (id: string, patch: Partial<LocalPaymentLine>) => {
    onPaymentLinesChange(
      paymentLines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    )
  }

  const addPaymentLine = () => {
    onPaymentLinesChange([...paymentLines, newPaymentLine()])
  }

  const removePaymentLine = (id: string) => {
    const next = paymentLines.filter((line) => line.id !== id)
    onPaymentLinesChange(next.length ? next : [newPaymentLine()])
  }

  const setPaymentPreset = (preset: 'unpaid' | 'full' | 'partial' | 'split') => {
    if (preset === 'unpaid') {
      onPaymentLinesChange([{ ...newPaymentLine(), amount: 0 }])
      setCashTendered(0)
      return
    }

    if (preset === 'full') {
      onPaymentLinesChange([{ ...newPaymentLine(), amount: taxPreview.grandTotal, payment_method: 'cash' }])
      setCashTendered(taxPreview.grandTotal)
      return
    }

    if (preset === 'partial') {
      const amount = Number((taxPreview.grandTotal / 2).toFixed(2))
      onPaymentLinesChange([{ ...newPaymentLine(), amount, payment_method: 'cash' }])
      setCashTendered(amount)
      return
    }

    const first = Number((taxPreview.grandTotal / 2).toFixed(2))
    const second = Number((taxPreview.grandTotal - first).toFixed(2))
    onPaymentLinesChange([
      { ...newPaymentLine(), amount: first, payment_method: 'cash' },
      { ...newPaymentLine(), amount: second, payment_method: 'upi' },
    ])
    setCashTendered(first)
  }

  return (
    <aside className="space-y-6">
      <section className="sticky top-24 rounded-[34px] bg-gradient-to-br from-[#f1f0ff] via-white to-[#f7f8ff] p-7 shadow-[0_24px_70px_rgba(79,70,229,0.12)] dark:from-slate-800 dark:via-slate-800 dark:to-slate-800/90 dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)]">
        <div className="mb-7 flex items-center gap-4">
          <div className="flex h-13 w-13 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] text-white shadow-[0_20px_48px_rgba(79,70,229,0.28)]">
            <WalletCards size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">
              Invoice Summary
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Server-checked totals and payments
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SummaryRow label="Subtotal" value={money(subtotal)} />
          <SummaryRow label="Discount Total" value={`-${money(discountTotal)}`} danger />

          {extraDiscountAmount > 0 && (
            <SummaryRow label="Extra Discount" value={`-${money(extraDiscountAmount)}`} danger />
          )}

          <SummaryRow label="Taxable Payable" value={money(taxPreview.taxableValue)} />
          {taxPreview.cgstAmount > 0 && <SummaryRow label="CGST" value={money(taxPreview.cgstAmount)} />}
          {taxPreview.sgstAmount > 0 && <SummaryRow label="SGST" value={money(taxPreview.sgstAmount)} />}
          {taxPreview.igstAmount > 0 && <SummaryRow label="IGST" value={money(taxPreview.igstAmount)} />}
          <SummaryRow label="Total GST" value={money(taxPreview.totalTaxAmount)} />
          <SummaryRow label="Total Billed Amount" value={money(taxPreview.grandTotal)} />

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-600" />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_120px] xl:items-end">
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Total Payable Amount
              </p>

              <div className="mt-3 flex h-[80px] w-full items-center gap-3 overflow-hidden rounded-[22px] border border-indigo-200/80 bg-white/70 px-5 shadow-[0_12px_32px_rgba(79,70,229,0.08)] transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_5px_rgba(99,102,241,0.14)] dark:border-slate-600 dark:bg-slate-700/60 dark:focus-within:border-indigo-500">
                <span className="shrink-0 text-[46px] font-black leading-none text-indigo-700 dark:text-indigo-400">
                  ₹
                </span>

                <input
                  type="number"
                  min={0}
                  max={totalBilledAmount}
                  step="0.01"
                  value={getNumberInputValue(totalPayable)}
                  placeholder="0"
                  onChange={(event) => {
                    const value = event.target.value
                    const nextValue = value === '' ? 0 : Number(value)
                    onTotalPayableChange(Math.min(Math.max(nextValue, 0), totalBilledAmount))
                  }}
                  className="min-w-0 flex-1 bg-transparent p-0 text-[46px] font-black leading-none text-indigo-700 outline-none placeholder:text-indigo-300 dark:text-indigo-400 dark:placeholder:text-indigo-500"
                />
              </div>
            </div>

            <div className="min-w-0 xl:text-right">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Remaining
              </p>

              <p className="mt-2 whitespace-nowrap text-lg font-black text-rose-600 dark:text-rose-400">
                {money(remainingAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-4">
          <p className="text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
            Lowering taxable payable will be saved as extra discount before GST.
          </p>

          {taxPreview.requiresCustomerState && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              Customer state is required for GST preview and backend GST calculation.
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                Payments
              </span>
              <button
                type="button"
                onClick={addPaymentLine}
                className="inline-flex h-9 items-center gap-2 rounded-2xl bg-indigo-50 px-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ['unpaid', 'Unpaid'],
                ['full', 'Full'],
                ['partial', 'Partial'],
                ['split', 'Split'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`payment-preset-${value}`}
                  onClick={() => setPaymentPreset(value as 'unpaid' | 'full' | 'partial' | 'split')}
                  className={`h-10 rounded-2xl text-xs font-black transition ${
                    paymentIntent === value
                      ? 'bg-indigo-600 text-white shadow-[0_12px_28px_rgba(79,70,229,0.25)]'
                      : 'bg-white text-slate-700 hover:bg-indigo-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {paymentLines.map((line, index) => {
              const paidBeforeLine = paymentLines
                .slice(0, index)
                .reduce((sum, item) => sum + Number(item.amount || 0), 0)
              const maxForLine = Math.max(taxPreview.grandTotal - paidBeforeLine, 0)

              return (
                <div
                  key={line.id}
                  className="rounded-[22px] border border-indigo-100 bg-white/85 p-4 dark:border-slate-600 dark:bg-slate-700/70"
                >
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <div className="flex h-12 items-center gap-3 rounded-[18px] border border-indigo-100 bg-slate-50 px-3 dark:border-slate-600 dark:bg-slate-800">
                        <span className="text-lg font-black text-indigo-700 dark:text-indigo-400">
                          ₹
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={maxForLine}
                          step="0.01"
                          value={getNumberInputValue(line.amount)}
                          placeholder="0"
                          onChange={(event) => {
                            const value = event.target.value
                            const nextValue = value === '' ? 0 : Number(value)
                            updatePaymentLine(line.id, {
                              amount: Math.min(Math.max(nextValue, 0), maxForLine),
                            })
                          }}
                          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200"
                        />
                      </div>

                      <select
                        value={line.payment_method}
                        onChange={(event) =>
                          updatePaymentLine(line.id, {
                            payment_method: event.target.value as PaymentMethod,
                          })
                        }
                        className="h-12 rounded-[18px] border border-indigo-100 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {paymentMethodOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removePaymentLine(line.id)}
                        className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                        aria-label="Remove payment"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <input
                      value={line.payment_reference}
                      onChange={(event) =>
                        updatePaymentLine(line.id, {
                          payment_reference: event.target.value,
                        })
                      }
                      placeholder="Reference, UPI/card/bank ref optional"
                      className="h-11 rounded-[16px] border border-indigo-100 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              )
            })}

            <div className="grid grid-cols-2 gap-3 rounded-[20px] bg-white/70 p-4 dark:bg-slate-700/60">
              <SummaryMini label="Paid" value={money(paidAmount)} />
              <SummaryMini label="Balance" value={money(remainingAmount)} danger={remainingAmount > 0} />
            </div>

            {hasCashPayment && (
              <div className="rounded-[20px] bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                  Amount Tendered
                </label>
                <div className="mt-2 flex h-11 items-center gap-2 rounded-2xl bg-white px-3 dark:bg-slate-800">
                  <span className="font-black text-emerald-700 dark:text-emerald-300">₹</span>
                  <input
                    data-testid="cash-tendered-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashTendered === 0 ? '' : cashTendered}
                    placeholder="0"
                    onChange={(event) => {
                      const nextValue = event.target.value === '' ? 0 : Number(event.target.value)
                      setCashTendered(Math.max(nextValue, 0))
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none dark:text-slate-200"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm font-black">
                  <span className="text-emerald-700 dark:text-emerald-300">Change Due</span>
                  <span data-testid="change-due-value" className="text-slate-950 dark:text-white">{money(changeDue)}</span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-emerald-700/80 dark:text-emerald-300/80">
                  Tendered cash is for cashier convenience only. The invoice records only the applied payment amount.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-7 grid gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            type="button"
            data-testid="save-invoice-button"
            onClick={onPreview}
            disabled={loading || disabled}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#7c6cff] via-[#5b43f3] to-[#2f20d6] text-sm font-black text-white shadow-[0_20px_48px_rgba(79,70,229,0.30)] transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
            {primaryActionLabel}
          </motion.button>

          <button
            type="button"
            onClick={onSaveDraft}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-[22px] bg-slate-100 text-sm font-black text-slate-800 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <Save size={18} />
            {secondaryActionLabel}
          </button>
        </div>

        <div className="mt-6 rounded-[24px] bg-white/80 p-5 dark:bg-slate-700/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-indigo-700 dark:text-indigo-400">
            <Info size={17} />
            Billing Note
          </div>
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
            Backend validates stock, GST, idempotency, and payment totals again before saving.
          </p>
        </div>
      </section>

      <section className="rounded-[30px] bg-white/80 p-6 shadow-[0_20px_54px_rgba(15,23,42,0.05)] dark:bg-slate-800/80 dark:shadow-[0_20px_54px_rgba(0,0,0,0.25)]">
        <div className="mb-4 flex items-center gap-3">
          <FileCheck2 size={20} className="text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
            Payment Notes
          </p>
        </div>

        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={5}
          placeholder="Add notes for this invoice..."
          className="w-full resize-none rounded-[20px] border border-indigo-100 bg-slate-50/90 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-700"
        />
      </section>
    </aside>
  )
}

function SummaryRow({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-black text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <span
        className={`text-sm font-black ${
          danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-950 dark:text-white'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function SummaryMini({
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
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-sm font-black ${danger ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  )
}
