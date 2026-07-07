export type ExpenseRange = 'all' | 'week' | 'month'

export type Expense = {
  id: number
  user_id: number
  shop_id: number
  title: string
  category: string
  amount: string | number
  expense_date: string
  payment_mode?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export type ExpenseListResponse = {
  items: Expense[]
  total: number
}

export type ExpensePayload = {
  title: string
  category: string
  amount: number
  expense_date: string
  payment_mode?: string | null
  notes?: string | null
}

export type ExpenseCategoryBreakdownItem = {
  category: string
  total: string | number
  count: number
  percentage: number
}

export type ExpenseTrendPoint = {
  label: string
  total: number
}

export type ExpenseAnalytics = {
  selected_range: ExpenseRange
  weekly_total: string | number
  weekly_count: number
  monthly_total: string | number
  monthly_count: number
  range_total: string | number
  range_count: number
  average_expense: string | number
  categories: ExpenseCategoryBreakdownItem[]
  trend: ExpenseTrendPoint[]
}