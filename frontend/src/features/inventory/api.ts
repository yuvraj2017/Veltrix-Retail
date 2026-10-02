import { api } from '../../lib/api'
import type {
  InventoryActivity,
  InventoryMovement,
  InventoryProduct,
  InventorySummary,
  Paged,
  ProductInventoryDetail,
  PurchasingReportItem,
  ReconciliationItem,
  VendorPurchasingInsight,
} from './types'

export const inventoryApi = {
  summary: async () => (await api.get<InventorySummary>('/api/v1/inventory/summary')).data,
  products: async (params: Record<string, unknown>) =>
    (await api.get<Paged<InventoryProduct>>('/api/v1/inventory/products', { params })).data,
  movements: async (params: Record<string, unknown>) =>
    (await api.get<Paged<InventoryMovement>>('/api/v1/inventory/movements', { params })).data,
  reconciliation: async (params: Record<string, unknown>) =>
    (await api.get<Paged<ReconciliationItem> & { mismatch_count: number }>(
      '/api/v1/inventory/reconciliation/report',
      { params },
    )).data,
  activity: async (dateFrom: string, dateTo: string) =>
    (await api.get<InventoryActivity>('/api/v1/inventory/activity', {
      params: { date_from: dateFrom, date_to: dateTo },
    })).data,
  purchasing: async (params: Record<string, unknown>) =>
    (await api.get<Paged<PurchasingReportItem>>('/api/v1/inventory/purchasing', { params })).data,
  vendorInsights: async (params: Record<string, unknown>) =>
    (await api.get<Paged<VendorPurchasingInsight>>('/api/v1/inventory/vendor-insights', { params })).data,
  productDetail: async (productId: number) =>
    (await api.get<ProductInventoryDetail>(`/api/v1/inventory/products/${productId}/detail`)).data,
  exportCsv: async (report: string, params: Record<string, unknown>) => {
    const response = await api.get<Blob>(`/api/v1/inventory/exports/${report}`, {
      params,
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${report}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
}
