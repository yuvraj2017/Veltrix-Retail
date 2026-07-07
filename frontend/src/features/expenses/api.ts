import { api } from '../../lib/api'
import type { Expense, ExpenseAnalytics, ExpenseListResponse, ExpensePayload, ExpenseRange } from './types'

export async function getExpenses(params?: {
  range?: ExpenseRange
  search?: string
  category?: string
  payment_mode?: string
}) {
  const { data } = await api.get<ExpenseListResponse>('/api/v1/expenses', { params })
  return data
}

export async function createExpense(payload: ExpensePayload) {
  const { data } = await api.post<Expense>('/api/v1/expenses', payload)
  return data
}

export async function updateExpense(expenseId: number, payload: Partial<ExpensePayload>) {
  const { data } = await api.put<Expense>(`/api/v1/expenses/${expenseId}`, payload)
  return data
}

export async function deleteExpense(expenseId: number) {
  const { data } = await api.delete<{ message: string }>(`/api/v1/expenses/${expenseId}`)
  return data
}

export async function getExpenseAnalytics(range: ExpenseRange) {
  const { data } = await api.get<ExpenseAnalytics>('/api/v1/expenses/analytics', {
    params: { range },
  })
  return data
}