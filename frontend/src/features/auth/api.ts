import { api } from '../../lib/api'
import type {
  AuthMessageResponse,
  ForgotPasswordPayload,
  LoginPayload,
  LoginResponse,
  MeResponse,
  RegisterResponse,
  ResetPasswordPayload,
  ResetTokenValidationResponse,
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

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const { data } = await api.post<AuthMessageResponse>('/api/v1/auth/forgot-password', payload)
  return data
}

export async function validateResetPasswordToken(token: string) {
  const { data } = await api.get<ResetTokenValidationResponse>('/api/v1/auth/reset-password/validate', {
    params: { token },
  })
  return data
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const { data } = await api.post<AuthMessageResponse>('/api/v1/auth/reset-password', payload)
  return data
}

export async function getCurrentUser() {
  const { data } = await api.get<MeResponse>('/api/v1/auth/me')
  return data
}
