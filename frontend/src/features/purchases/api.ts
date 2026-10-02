import { api } from '../../lib/api'
import type {
  GoodsReceipt,
  PurchaseOrder,
  PurchaseOrderList,
  PurchaseOrderPayload,
  PurchaseReturn,
  PurchaseReturnEligibility,
} from './types'

export async function getPurchaseOrders(status?: string) {
  const { data } = await api.get<PurchaseOrderList>('/api/v1/purchase-orders', {
    params: { page: 1, page_size: 100, status: status || undefined },
  })
  return data
}

export async function getPurchaseOrder(id: number) {
  const { data } = await api.get<PurchaseOrder>(`/api/v1/purchase-orders/${id}`)
  return data
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload) {
  const { data } = await api.post<PurchaseOrder>('/api/v1/purchase-orders', payload)
  return data
}

export async function updatePurchaseOrder(id: number, payload: Partial<PurchaseOrderPayload>) {
  const { data } = await api.put<PurchaseOrder>(`/api/v1/purchase-orders/${id}`, payload)
  return data
}

export async function cancelPurchaseOrder(id: number) {
  const { data } = await api.post<PurchaseOrder>(`/api/v1/purchase-orders/${id}/cancel`)
  return data
}

export async function getGoodsReceipts(poId: number) {
  const { data } = await api.get<GoodsReceipt[]>(`/api/v1/purchase-orders/${poId}/receipts`)
  return data
}

export async function createGoodsReceipt(
  poId: number,
  payload: {
    client_request_id: string
    received_date: string
    notes?: string | null
    items: Array<{
      purchase_order_item_id: number
      received_quantity: number
      unit_cost?: number | null
    }>
  },
) {
  const { data } = await api.post<GoodsReceipt>(
    `/api/v1/purchase-orders/${poId}/receipts`,
    payload,
  )
  return data
}

export async function getPurchaseReturnEligibility(poId: number) {
  const { data } = await api.get<PurchaseReturnEligibility[]>(
    `/api/v1/purchase-orders/${poId}/return-eligibility`,
  )
  return data
}

export async function getPurchaseReturns(poId: number) {
  const { data } = await api.get<PurchaseReturn[]>(`/api/v1/purchase-orders/${poId}/returns`)
  return data
}

export async function createPurchaseReturn(
  poId: number,
  payload: {
    client_request_id: string
    return_date: string
    reason: 'damaged' | 'defective' | 'wrong_item' | 'excess_quantity' | 'quality_issue' | 'other'
    notes?: string | null
    items: Array<{ goods_receipt_item_id: number; returned_quantity: number }>
  },
) {
  const { data } = await api.post<PurchaseReturn>(
    `/api/v1/purchase-orders/${poId}/returns`,
    payload,
  )
  return data
}
