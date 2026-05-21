import type {
  CustomerAnalyticsStats,
  CustomerDetail,
  CustomerInsight,
  CustomerLedgerResponse,
} from './types'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'

function getToken() {
  return localStorage.getItem('access_token') || localStorage.getItem('token')
}

async function apiRequest<T>(path: string): Promise<T> {
  const token = getToken()

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.detail || 'Something went wrong')
  }

  return response.json()
}

export function getCustomerAnalyticsStats() {
  return apiRequest<CustomerAnalyticsStats>('/customer-analytics/stats')
}

export function getCustomerLedger(params?: {
  search?: string
  status?: string
  page?: number
  limit?: number
}) {
  const searchParams = new URLSearchParams()

  if (params?.search) searchParams.set('search', params.search)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const query = searchParams.toString()

  return apiRequest<CustomerLedgerResponse>(
    `/customer-analytics/ledger${query ? `?${query}` : ''}`,
  )
}

export function getCustomerInsights() {
  return apiRequest<CustomerInsight>('/customer-analytics/insights')
}

export function getCustomerDetail(customerId: number) {
  return apiRequest<CustomerDetail>(`/customer-analytics/${customerId}`)
}