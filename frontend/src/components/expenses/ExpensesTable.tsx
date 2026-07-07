import { PencilLine, Receipt, Trash2 } from 'lucide-react'

import type { Expense } from '../../features/expenses/types'

type ExpensesTableProps = {
  expenses: Expense[]
  loading: boolean
  deletingId: number | null
  onEdit: (expense: Expense) => void
  onDelete: (expense: Expense) => void
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

const formatCurrency = (value: string | number) => currencyFormatter.format(Number(value || 0))

const formatExpenseDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export function ExpensesTable({
  expenses,
  loading,
  deletingId,
  onEdit,
  onDelete,
}: ExpensesTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[1.75rem] bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/70">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400 dark:shadow-none">
          <Receipt size={28} />
        </div>
        <h3 className="mt-5 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-slate-100">
          No expenses found
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
          Start recording rent, salaries, utility bills, and maintenance costs to build your expense history.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_55px_rgba(0,0,0,0.3)]">
      <div className="hidden md:block">
        <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_1.1fr_0.7fr_0.7fr] gap-4 border-b border-slate-100 px-6 py-4 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div>Expense</div>
          <div>Category</div>
          <div>Date</div>
          <div>Payment</div>
          <div>Notes</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Actions</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_1.1fr_0.7fr_0.7fr] gap-4 px-6 py-5 text-sm text-slate-700 dark:text-slate-300"
            >
              <div>
                <p className="font-bold text-slate-950 dark:text-slate-100">{expense.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  #{expense.id}
                </p>
              </div>
              <div>
                <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  {expense.category}
                </span>
              </div>
              <div className="font-medium text-slate-600 dark:text-slate-400">{formatExpenseDate(expense.expense_date)}</div>
              <div className="font-medium text-slate-600 dark:text-slate-400">{expense.payment_mode || 'N/A'}</div>
              <div className="line-clamp-2 text-slate-500 dark:text-slate-400">{expense.notes || 'No notes added'}</div>
              <div className="text-right font-black text-slate-950 dark:text-slate-100">{formatCurrency(expense.amount)}</div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(expense)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400"
                  aria-label={`Edit ${expense.title}`}
                >
                  <PencilLine size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(expense)}
                  disabled={deletingId === expense.id}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
                  aria-label={`Delete ${expense.title}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4 md:hidden">
        {expenses.map((expense) => (
          <div key={expense.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 dark:shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black tracking-[-0.02em] text-slate-950 dark:text-slate-100">{expense.title}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {expense.category}
                </p>
              </div>
              <p className="text-base font-black text-slate-950 dark:text-slate-100">{formatCurrency(expense.amount)}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-400">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Date</p>
                <p className="mt-1 font-medium">{formatExpenseDate(expense.expense_date)}</p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Payment</p>
                <p className="mt-1 font-medium">{expense.payment_mode || 'N/A'}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Notes</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{expense.notes || 'No notes added'}</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(expense)}
                className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200 dark:shadow-none dark:hover:bg-slate-600"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(expense)}
                disabled={deletingId === expense.id}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-rose-500"
              >
                {deletingId === expense.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}