import { api } from '../../lib/api'
import type { AccessibleBranchListResponse, ActiveBranchDetails } from './types'

export async function getAccessibleBranches(contextBranchId?: number | null) {
  const { data } = await api.get<AccessibleBranchListResponse>('/api/v1/branches', {
    headers: contextBranchId
      ? { 'X-Branch-ID': String(contextBranchId) }
      : undefined,
  })
  return data.items
}

export async function getActiveBranchDetails(branchId: number) {
  const { data } = await api.get<ActiveBranchDetails>(`/api/v1/shops/${branchId}`, {
    headers: { 'X-Branch-ID': String(branchId) },
  })
  return data
}
