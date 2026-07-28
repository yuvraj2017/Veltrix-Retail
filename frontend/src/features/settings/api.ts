import { api } from '../../lib/api'
import type { ShopSettings, UpdateShopPayload } from './types'

export async function getShopSettings(shopId: number) {
  const { data } = await api.get<ShopSettings>(`/api/v1/shops/${shopId}`)
  return data
}

export async function updateShopSettings(shopId: number, payload: UpdateShopPayload) {
  const { data } = await api.put<ShopSettings>(`/api/v1/shops/${shopId}`, payload)
  return data
}
