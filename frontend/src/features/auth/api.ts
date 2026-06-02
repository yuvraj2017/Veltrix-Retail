import { api } from '../../lib/api'
import type {
  LoginPayload,
  LoginResponse,
  MeResponse,
  RegisterResponse,
} from './types'

export async function registerShop(payload: FormData) {
  const { data } = await api.post<RegisterResponse>('/api/v1/auth/register', payload, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export async function loginUser(payload: LoginPayload) {
  const { data } = await api.post<LoginResponse>('/api/v1/auth/login', payload)
  return data
}

export async function getCurrentUser() {
  const { data } = await api.get<MeResponse>('/api/v1/auth/me')
  return data
}