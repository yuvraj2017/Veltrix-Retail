import { api } from '../../lib/api'
import type {
  OwnershipTransferResult,
  StaffCreatePayload,
  StaffMember,
  StaffUpdatePayload,
} from './types'

const STAFF_PATH = '/api/v1/organizations/current/staff'

export async function listStaff(): Promise<StaffMember[]> {
  const response = await api.get<StaffMember[]>(STAFF_PATH)
  return response.data
}

export async function createStaff(payload: StaffCreatePayload): Promise<StaffMember> {
  const response = await api.post<StaffMember>(STAFF_PATH, payload)
  return response.data
}

export async function updateStaff(
  membershipId: number,
  payload: StaffUpdatePayload,
): Promise<StaffMember> {
  const response = await api.patch<StaffMember>(`${STAFF_PATH}/${membershipId}`, payload)
  return response.data
}

export async function grantStaffBranch(
  membershipId: number,
  shopId: number,
): Promise<StaffMember> {
  const response = await api.post<StaffMember>(
    `${STAFF_PATH}/${membershipId}/branches/${shopId}`,
  )
  return response.data
}

export async function revokeStaffBranch(
  membershipId: number,
  shopId: number,
): Promise<StaffMember> {
  const response = await api.delete<StaffMember>(
    `${STAFF_PATH}/${membershipId}/branches/${shopId}`,
  )
  return response.data
}

export async function transferOwnership(
  targetMembershipId: number,
): Promise<OwnershipTransferResult> {
  const response = await api.post<OwnershipTransferResult>(`${STAFF_PATH}/ownership-transfer`, {
    target_membership_id: targetMembershipId,
  })
  return response.data
}

