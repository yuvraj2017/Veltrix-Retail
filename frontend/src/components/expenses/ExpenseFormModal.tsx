import { zodResolver } from '@hookform/resolvers/zod'
import { ReceiptText, Wallet, X } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { ExpenseDatePicker } from './ExpenseDatePicker'
import { ExpenseSelect } from './ExpenseSelect'
import { expenseCategories, expenseSchema, paymentModes, type ExpenseFormValues } from '../../features/expenses/schemas'
import type { Expense } from '../../features/expenses/types'

type ExpenseFormModalProps = {
  open: boolean
  expense: Expense | null
  error: string
  loading: boolean
  onClose: () => void
  onSubmit: (values: ExpenseFormValues) => void
}

const getTodayDate = () => new Date().toISOString().slice(0, 10)
const categoryOptions = expenseCategories.map((category) => ({ label: category, value: category }))
const paymentModeOptions = paymentModes.map((mode) => ({ label: mode, value: mode }))

export function ExpenseFormModal({
  open,
  expense,
  error,
  loading,
  onClose,
  onSubmit,
}: ExpenseFormModalProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: '',
      category: expenseCategories[0],
      amount: 0,
      expense_date: getTodayDate(),
      payment_mode: paymentModes[0],
      notes: '',
    },
  })

  useEffect(() => {
    if (!open) return

    reset({
      title: expense?.title || '',
      category: expense?.category || expenseCategories[0],
      amount: expense ? Number(expense.amount || 0) : 0,
      expense_date: expense?.expense_date || getTodayDate(),
      payment_mode: expense?.payment_mode || paymentModes[0],
      notes: expense?.notes || '',
    })
  }, [expense, open, reset])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-6 dark:bg-black/70">
      <div className="w-full max-w-2xl overflow-hidden rounded-t-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] dark:bg-slate-900 dark:shadow-[0_30px_80px_rgba(0,0,0,0.65)] sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Wallet size={14} />
              Expense Ledger
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">
              {expense ? 'Edit Expense' : 'Add Expense'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track rent, salaries, utilities, and every other business outgoing in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label="Close expense form"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Title / Name</label>
              <div className="relative">
                <ReceiptText size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  {...register('title')}
                  placeholder="Office rent, electricity bill, salary payout..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/40"
                />
              </div>
              {errors.title && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.title.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Category</label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <ExpenseSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={categoryOptions}
                  />
                )}
              />
              {errors.category && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.category.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Amount</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                {...register('amount')}
                placeholder="0.00"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/40"
              />
              {errors.amount && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Expense Date</label>
              <Controller
                control={control}
                name="expense_date"
                render={({ field }) => (
                  <ExpenseDatePicker
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.expense_date && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.expense_date.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Payment Mode</label>
              <Controller
                control={control}
                name="payment_mode"
                render={({ field }) => (
                  <ExpenseSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={paymentModeOptions}
                  />
                )}
              />
              {errors.payment_mode && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.payment_mode.message}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Notes / Description</label>
              <textarea
                rows={4}
                {...register('notes')}
                placeholder="Add any bill details, vendor notes, transaction references, or remarks."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/40"
              />
              {errors.notes && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.notes.message}</p>}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(79,70,229,0.22)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-indigo-500"
            >
              {loading ? 'Saving...' : expense ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}