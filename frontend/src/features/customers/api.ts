import { api } from '../../lib/api'
import type {
  CustomerAnalyticsDetail,
  CustomerCharts,
  CustomerDirectoryResponse,
  CustomerInsight,
  CustomerPayload,
  CustomerRecord,
  CustomerSummary,
} from './types'

export async function getCustomers(params?: {
  search?: string
  status?: string
  sort_by?: string
  page?: number
  page_size?: number
}) {
  const { data } = await api.get<CustomerDirectoryResponse>('/api/v1/customers', {
    params,
  })
  return data
}

export async function getCustomerSummary() {
  const { data } = await api.get<CustomerSummary>('/api/v1/customers/summary')
  return data
}

export async function getCustomerCharts(months = 6) {
  const { data } = await api.get<CustomerCharts>('/api/v1/customers/charts', {
    params: { months },
  })
  return data
}

export async function getCustomerInsights() {
  const { data } = await api.get<CustomerInsight>('/api/v1/customers/insights')
  return data
}

export async function getCustomerById(customerId: number) {
  const { data } = await api.get<CustomerRecord>(`/api/v1/customers/${customerId}`)
  return data
}

export async function getCustomerAnalytics(customerId: number) {
  const { data } = await api.get<CustomerAnalyticsDetail>(
    `/api/v1/customers/${customerId}/analytics`,
  )
  return data
}

export async function createCustomer(payload: CustomerPayload) {
  const { data } = await api.post<CustomerRecord>('/api/v1/customers', payload)
  return data
}

export async function updateCustomer(customerId: number, payload: Partial<CustomerPayload>) {
  const { data } = await api.put<CustomerRecord>(`/api/v1/customers/${customerId}`, payload)
  return data
}
