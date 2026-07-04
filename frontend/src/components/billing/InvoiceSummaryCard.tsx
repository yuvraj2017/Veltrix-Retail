import { motion } from 'framer-motion'
import {
  Eye,
  FileCheck2,
  Info,
  Loader2,
  Save,
  WalletCards,
} from 'lucide-react'

import type {
  LocalInvoiceItem,
  PaymentMode,
  PaymentStatus,
} from '../../features/billing/types'

type InvoiceSummaryCardProps = {
  items: LocalInvoiceItem[]
  totalBilledAmount: number
  totalPayable: number
  onTotalPayableChange: (value: number) => void
  paidAmount: number
  onPaidAmountChange: (value: number) => void
  paymentMode: PaymentMode | ''
  onPaymentModeChange: (value: PaymentMode | '') => void
  paymentStatus: PaymentStatus
  onPaymentStatusChange: (value: PaymentStatus) => void
  notes: string
  onNotesChange: (value: string) => void
  onPreview: () => void
  onSaveDraft: () => void
  loading?: boolean
  primaryActionLabel?: string
  secondaryActionLabel?: string
}

const money = (value: number) => {
  return value.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  })
}

const getNumberInputValue = (value: number) => {
  return value === 0 ? '' : value
}

export default function InvoiceSummaryCard({
  items,
  totalBilledAmount,
  totalPayable,
  onTotalPayableChange,
  paidAmount,
  onPaidAmountChange,
  paymentMode,
  onPaymentModeChange,
  paymentStatus,
  onPaymentStatusChange,
  notes,
  onNotesChange,
  onPreview,
  onSaveDraft,
  loading = false,
  primaryActionLabel = 'Save & Preview Invoice',
  secondaryActionLabel = 'Save Draft Locally',
}: InvoiceSummaryCardProps) {
  const subtotal = items.reduce((sum, item) => sum + item.mrp * item.quantity, 0)
  const itemDiscountTotal = items.reduce(
    (sum, item) => sum + item.total_discount_amount,
    0
  )
  const taxAmount = 0
  const extraDiscountAmount = Math.max(totalBilledAmount - totalPayable, 0)
  const discountTotal = itemDiscountTotal + extraDiscountAmount
  const remainingAmount = Math.max(totalPayable - paidAmount, 0)

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
              Real-time total calculation
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SummaryRow label="Subtotal" value={money(subtotal)} />
          <SummaryRow label="Discount Total" value={`-${money(discountTotal)}`} danger />

          {extraDiscountAmount > 0 && (
            <SummaryRow
              label="Extra Discount"
              value={`-${money(extraDiscountAmount)}`}
              danger
            />
          )}

          <SummaryRow label="Tax" value={money(taxAmount)} />
          <SummaryRow label="Total Billed Amount" value={money(totalBilledAmount)} />

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-600" />

          {/* <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_140px] lg:items-end">
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Total Payable Amount
              </p>

              <div className="mt-3 flex h-[72px] w-full items-center gap-3 overflow-hidden rounded-[22px] border border-indigo-200/80 bg-white/70 px-5 shadow-[0_12px_32px_rgba(79,70,229,0.08)] transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_5px_rgba(99,102,241,0.14)] dark:border-slate-600 dark:bg-slate-700/60 dark:focus-within:border-indigo-500">
                <span className="shrink-0 text-[46px] font-black leading-none tracking-[-0.06em] text-indigo-700 dark:text-indigo-400">
                  ₹
                </span>

                <input
                  type="number"
                  min={0}
                  max={totalBilledAmount}
                  step="0.01"
                  value={getNumberInputValue(totalPayable)}
                  placeholder="0"
                  onFocus={(event) => {
                    if (event.target.value === '0') event.target.select()
                  }}
                  onChange={(event) => {
                    const value = event.target.value
                    const nextValue = value === '' ? 0 : Number(value)

                    onTotalPayableChange(
                      Math.min(Math.max(nextValue, 0), totalBilledAmount)
                    )
                  }}
                  className="min-w-0 w-full flex-1 bg-transparent p-0 text-[46px] font-black leading-none tracking-[-0.06em] text-indigo-700 outline-none placeholder:text-indigo-300 dark:text-indigo-400 dark:placeholder:text-indigo-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="min-w-0 lg:text-right">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Remaining
              </p>

              <p className="mt-2 break-words text-lg font-black text-rose-600 dark:text-rose-400">
                {money(remainingAmount)}
              </p>
            </div>
          </div> */}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_120px] xl:items-end">
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Total Payable Amount
              </p>

              <div className="mt-3 flex h-[80px] w-full items-center gap-3 overflow-hidden rounded-[22px] border border-indigo-200/80 bg-white/70 px-5 shadow-[0_12px_32px_rgba(79,70,229,0.08)] transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_5px_rgba(99,102,241,0.14)] dark:border-slate-600 dark:bg-slate-700/60 dark:focus-within:border-indigo-500">
                <span className="shrink-0 text-[46px] font-black leading-none tracking-[-0.06em] text-indigo-700 dark:text-indigo-400">
                  ₹
                </span>

                <input
                  type="number"
                  min={0}
                  max={totalBilledAmount}
                  step="0.01"
                  value={getNumberInputValue(totalPayable)}
                  placeholder="0"
                  onFocus={(event) => {
                    if (event.target.value === '0') event.target.select()
                  }}
                  onChange={(event) => {
                    const value = event.target.value
                    const nextValue = value === '' ? 0 : Number(value)

                    onTotalPayableChange(
                      Math.min(Math.max(nextValue, 0), totalBilledAmount)
                    )
                  }}
                  style={{
                    fontSize: '46px',
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                  className="min-w-0 flex-1 bg-transparent p-0 tracking-[-0.06em] text-indigo-700 outline-none placeholder:text-indigo-300 dark:text-indigo-400 dark:placeholder:text-indigo-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
            Lowering payable will be saved as extra discount on the invoice.
          </p>

          <label className="space-y-2">
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
              Paid Amount
            </span>

            <div className="flex h-13 items-center gap-3 rounded-[20px] border border-indigo-100 bg-white px-4 transition focus-within:border-indigo-300 focus-within:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:border-slate-600 dark:bg-slate-700 dark:focus-within:border-indigo-500 dark:focus-within:shadow-[0_0_0_5px_rgba(99,102,241,0.2)]">
              <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">
                ₹
              </span>

              <input
                type="number"
                min={0}
                max={totalPayable}
                step="0.01"
                value={getNumberInputValue(paidAmount)}
                placeholder="0"
                onFocus={(event) => {
                  if (event.target.value === '0') event.target.select()
                }}
                onChange={(event) => {
                  const value = event.target.value
                  const nextValue = value === '' ? 0 : Number(value)

                  onPaidAmountChange(Math.min(Math.max(nextValue, 0), totalPayable))
                }}
                className="min-w-0 flex-1 bg-transparent font-bold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
              Payment Mode
            </span>
            <select
              value={paymentMode}
              onChange={(event) =>
                onPaymentModeChange(event.target.value as PaymentMode | '')
              }
              className="h-13 w-full rounded-[20px] border border-indigo-100 bg-white px-4 font-bold text-slate-800 outline-none transition focus:border-indigo-300 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.2)]"
            >
              <option value="">Select mode</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
              Payment Status
            </span>
            <select
              value={paymentStatus}
              onChange={(event) =>
                onPaymentStatusChange(event.target.value as PaymentStatus)
              }
              className="h-13 w-full rounded-[20px] border border-indigo-100 bg-white px-4 font-bold text-slate-800 outline-none transition focus:border-indigo-300 focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.2)]"
            >
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </label>
        </div>

        <div className="mt-7 grid gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            type="button"
            onClick={onPreview}
            disabled={loading}
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
            Backend will validate customer, product stock, discount, totals, and profit again before saving.
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
          className="w-full resize-none rounded-[20px] border border-indigo-100 bg-slate-50/90 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_5px_rgba(99,102,241,0.12)] dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-700 dark:focus:shadow-[0_0_0_5px_rgba(99,102,241,0.2)]"
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
          danger
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-slate-950 dark:text-white'
        }`}
      >
        {value}
      </span>
    </div>
  )
}