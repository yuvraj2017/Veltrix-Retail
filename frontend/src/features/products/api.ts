import { api } from '../../lib/api'
import type {
  Product,
  ProductListResponse,
  StockMovementList,
  StockAdjustmentResult,
  ProductStats,
} from './types'

export async function getProducts(params?: {
  search?: string
  category?: string
  stock_status?: string
  sort_by?: string
  page?: number
  page_size?: number
}) {
  const { data } = await api.get<ProductListResponse>('/api/v1/products', { params })
  return data
}

/**
 * Distinct categories for the current shop. Replaces the previous approach of
 * fetching the entire product list a second time just to derive this in JS.
 */
export async function getProductCategories() {
  const { data } = await api.get<string[]>('/api/v1/products/categories')
  return data
}

export async function getProductStats() {
  const { data } = await api.get<ProductStats>('/api/v1/products/stats')
  return data
}

export async function getProductById(productId: number) {
  const { data } = await api.get<Product>(`/api/v1/products/${productId}`)
  return data
}

export async function createProduct(formData: FormData) {
  const { data } = await api.post<Product>('/api/v1/products', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export async function updateProduct(productId: number, formData: FormData) {
  const { data } = await api.put<Product>(`/api/v1/products/${productId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export async function deleteProduct(productId: number) {
  const { data } = await api.delete(`/api/v1/products/${productId}`)
  return data
}

export async function getProductStockMovements(productId: number, page = 1, pageSize = 20) {
  const { data } = await api.get<StockMovementList>(
    `/api/v1/inventory/products/${productId}/movements`,
    { params: { page, page_size: pageSize } },
  )
  return data
}

export async function createStockAdjustment(
  productId: number,
  payload: {
    client_request_id: string
    direction: 'in' | 'out'
    quantity: number
    reason: string
    notes?: string | null
  },
) {
  const { data } = await api.post<StockAdjustmentResult>(
    `/api/v1/inventory/products/${productId}/adjustments`,
    payload,
  )
  return data
}

export async function recordPhysicalStockCount(
  productId: number,
  payload: {
    client_request_id: string
    counted_quantity: number
    reason: string
    notes?: string | null
  },
) {
  const { data } = await api.post<StockAdjustmentResult>(
    `/api/v1/inventory/products/${productId}/physical-count`,
    payload,
  )
  return data
}

export async function deleteProductImage(imageId: number) {
  const { data } = await api.delete(`/api/v1/products/images/${imageId}`)
  return data
}
