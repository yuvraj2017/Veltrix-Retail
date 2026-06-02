import { api } from '../../lib/api'
import type { ChangePasswordPayload, Profile, UpdateProfilePayload } from './types'

export async function getMyProfile() {
  const { data } = await api.get<Profile>('/api/v1/profile/me')
  return data
}

export async function updateMyProfile(payload: UpdateProfilePayload) {
  const { data } = await api.put<Profile>('/api/v1/profile/me', payload)
  return data
}

export async function changeMyPassword(payload: ChangePasswordPayload) {
  const { data } = await api.put('/api/v1/profile/change-password', payload)
  return data
}