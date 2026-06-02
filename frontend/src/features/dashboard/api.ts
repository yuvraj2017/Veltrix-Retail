import { api } from '../../lib/api'
import type { DashboardOverview } from './types'

export async function getDashboardOverview() {
  const { data } = await api.get<DashboardOverview>('/api/v1/dashboard/overview')
  return data
}