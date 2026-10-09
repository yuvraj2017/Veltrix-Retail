import { api } from '../../lib/api'
import type { Plan, SubscriptionOverview } from '../admin/types'

export async function getMySubscription() {
  const { data } = await api.get<SubscriptionOverview>('/api/v1/subscription/me')
  return data
}

export async function getAvailablePlans() {
  const { data } = await api.get<Plan[]>('/api/v1/subscription/plans')
  return data
}

export async function createCheckoutSession(payload: {
  plan_id: number
  catalog_version_id: number
  billing_interval: 'monthly' | 'annual'
}) {
  const { data } = await api.post<{
    provider: string
    status: string
    message: string
    checkout_url?: string | null
    metadata: Record<string, unknown>
  }>('/api/v1/subscription/checkout', payload)
  return data
}

export async function verifyRazorpayPayment(payload: {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}) {
  const { data } = await api.post('/api/v1/subscription/payments/razorpay/verify', payload)
  return data
}

export async function submitUpiPaymentReference(payload: {
  payment_id: string
  customer_reference: string
}) {
  const { data } = await api.post('/api/v1/subscription/payments/upi/submit', payload)
  return data
}
