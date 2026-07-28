import { api } from '../../lib/api'
import type {
  CashflowReport,
  CategoryPerformanceReport,
  CustomerInsightsReport,
  PaymentInsightsReport,
  ReportPeriod,
  ReportSummary,
  SalesProfitReport,
} from './types'

export async function getReportSummary() {
  const { data } = await api.get<ReportSummary>('/api/v1/reports/summary')
  return data
}

export async function getSalesProfitReport(period: ReportPeriod) {
  const { data } = await api.get<SalesProfitReport>('/api/v1/reports/sales-profit', {
    params: { period },
  })
  return data
}

export async function getCashflowReport(period: ReportPeriod) {
  const { data } = await api.get<CashflowReport>('/api/v1/reports/cashflow', {
    params: { period },
  })
  return data
}

export async function getCategoryPerformanceReport(period: ReportPeriod) {
  const { data } = await api.get<CategoryPerformanceReport>(
    '/api/v1/reports/category-performance',
    {
      params: { period },
    },
  )
  return data
}

export async function getCustomerInsightsReport(period: ReportPeriod) {
  const { data } = await api.get<CustomerInsightsReport>(
    '/api/v1/reports/customer-insights',
    {
      params: { period },
    },
  )
  return data
}

export async function getPaymentInsightsReport(period: ReportPeriod) {
  const { data } = await api.get<PaymentInsightsReport>(
    '/api/v1/reports/payment-insights',
    {
      params: { period },
    },
  )
  return data
}
