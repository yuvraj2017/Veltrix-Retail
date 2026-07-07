import { z } from 'zod'

export const expenseCategories = [
  'Rent',
  'Electricity',
  'Water',
  'Maintenance',
  'Salaries',
  'Internet',
  'Utilities',
  'Supplies',
  'Transport',
  'Repairs',
  'Marketing',
  'Miscellaneous',
] as const

export const paymentModes = [
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Cheque',
  'Auto Debit',
  'Other',
] as const

export const expenseSchema = z.object({
  title: z.string().trim().min(2, 'Enter a valid expense title').max(200),
  category: z.string().trim().min(2, 'Select a category').max(100),
  amount: z.coerce.number().gt(0, 'Amount must be greater than zero'),
  expense_date: z.string().min(1, 'Select an expense date'),
  payment_mode: z.string().trim().min(2, 'Select a payment mode').max(50),
  notes: z.string().trim().max(2000, 'Notes must be under 2000 characters').optional().or(z.literal('')),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>