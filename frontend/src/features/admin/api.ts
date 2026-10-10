import { api } from '../../lib/api'
import type {
  AdminActionResponse,
  AdminAuditAction,
  AdminAuditLogResponse,
  AdminStats,
  EntitlementDefinition,
  License,
  Plan,
  PlanCatalogPublishPayload,
  PlanCatalogVersion,
  PlanCreatePayload,
  PlanEntitlement,
  PaymentGatewayConfig,
  ShopOverride,
  ShopSummary,
  Subscription,
  SubscriptionOverview,
  SubscriptionPayment,
  AdminUserDetail,
  AdminUserListParams,
  AdminUserListResponse,
  UserRole,
} from './types'

/**
 * Admin API client.
 *
 * Uses the shared axios instance so it inherits the bearer-token request
 * interceptor and the session-expiry response interceptor, rather than
 * re-implementing token handling the way features/billing and features/vendors
 * historically did.
 */

export async function getAdminStats() {
  const { data } = await api.get<AdminStats>('/api/v1/admin/stats')
  return data
}

export async function getAdminUsers(params?: AdminUserListParams) {
  // Empty strings are dropped rather than sent, so "no filter" does not become
  // `?status=` and trip the server-side allow-list validation.
  const { data } = await api.get<AdminUserListResponse>('/api/v1/admin/users', {
    params: {
      search: params?.search || undefined,
      status: params?.status || undefined,
      role: params?.role || undefined,
      sort_by: params?.sort_by || undefined,
      page: params?.page,
      page_size: params?.page_size,
    },
  })
  return data
}

export async function getAdminUser(userId: number) {
  const { data } = await api.get<AdminUserDetail>(`/api/v1/admin/users/${userId}`)
  return data
}

export async function approveUser(userId: number) {
  const { data } = await api.post<AdminActionResponse>(
    `/api/v1/admin/users/${userId}/approve`,
  )
  return data
}

export async function rejectUser(userId: number, reason?: string) {
  const { data } = await api.post<AdminActionResponse>(
    `/api/v1/admin/users/${userId}/reject`,
    { reason: reason || null },
  )
  return data
}

export async function suspendUser(userId: number, reason?: string) {
  const { data } = await api.post<AdminActionResponse>(
    `/api/v1/admin/users/${userId}/suspend`,
    { reason: reason || null },
  )
  return data
}

export async function reactivateUser(userId: number) {
  const { data } = await api.post<AdminActionResponse>(
    `/api/v1/admin/users/${userId}/reactivate`,
  )
  return data
}

export async function disableUser(userId: number, reason?: string) {
  const { data } = await api.post<AdminActionResponse>(
    `/api/v1/admin/users/${userId}/disable`,
    { reason: reason || null },
  )
  return data
}

export async function changeUserRole(userId: number, role: UserRole) {
  const { data } = await api.patch<AdminActionResponse>(
    `/api/v1/admin/users/${userId}/role`,
    { role },
  )
  return data
}

export async function getAuditLogs(params?: {
  action?: AdminAuditAction | ''
  actor_id?: number
  target_user_id?: number
  page?: number
  page_size?: number
}) {
  const { data } = await api.get<AdminAuditLogResponse>('/api/v1/admin/audit-logs', {
    params: {
      action: params?.action || undefined,
      actor_id: params?.actor_id || undefined,
      target_user_id: params?.target_user_id || undefined,
      page: params?.page,
      page_size: params?.page_size,
    },
  })
  return data
}

export async function getPlans(includeArchived = false) {
  const { data } = await api.get<Plan[]>('/api/v1/admin/plans', {
    params: { include_archived: includeArchived },
  })
  return data
}

export async function createPlan(payload: PlanCreatePayload) {
  const { data } = await api.post<Plan>('/api/v1/admin/plans', payload)
  return data
}

export async function updatePlan(planId: number, payload: Partial<Plan>) {
  const { data } = await api.patch<Plan>(`/api/v1/admin/plans/${planId}`, payload)
  return data
}

export async function getPlanCatalogVersions(planId: number) {
  const { data } = await api.get<PlanCatalogVersion[]>(
    `/api/v1/admin/plans/${planId}/catalog-versions`,
  )
  return data
}

export async function publishPlanCatalogVersion(
  planId: number,
  payload: PlanCatalogPublishPayload,
) {
  const { data } = await api.post<PlanCatalogVersion>(
    `/api/v1/admin/plans/${planId}/catalog-versions`,
    payload,
  )
  return data
}

export async function getEntitlements() {
  const { data } = await api.get<EntitlementDefinition[]>('/api/v1/admin/entitlements')
  return data
}

export async function createEntitlement(payload: {
  key: string
  name: string
  kind: 'limit' | 'feature'
  value_type: string
  resource_key?: string | null
}) {
  const { data } = await api.post<EntitlementDefinition>('/api/v1/admin/entitlements', payload)
  return data
}

export async function getPlanEntitlements(planId: number) {
  const { data } = await api.get<PlanEntitlement[]>(
    `/api/v1/admin/plans/${planId}/entitlements`,
  )
  return data
}

export async function upsertPlanEntitlement(
  planId: number,
  entitlementId: number,
  payload: {
    limit_value?: string | number | null
    is_unlimited?: boolean
    feature_enabled?: boolean | null
  },
) {
  const { data } = await api.put<PlanEntitlement>(
    `/api/v1/admin/plans/${planId}/entitlements/${entitlementId}`,
    payload,
  )
  return data
}

export async function getAdminShops() {
  const { data } = await api.get<ShopSummary[]>('/api/v1/admin/shops')
  return data
}

export async function getShopSubscriptionOverview(shopId: number) {
  const { data } = await api.get<SubscriptionOverview>(
    `/api/v1/admin/shops/${shopId}/subscription`,
  )
  return data
}

export async function assignShopSubscription(
  shopId: number,
  payload: { plan_id: number; status: string; billing_interval: string; reason?: string | null },
) {
  const { data } = await api.post<Subscription>(
    `/api/v1/admin/shops/${shopId}/subscription`,
    payload,
  )
  return data
}

export async function updateSubscriptionStatus(
  subscriptionId: number,
  payload: { status: string; reason?: string | null },
) {
  const { data } = await api.patch<Subscription>(
    `/api/v1/admin/subscriptions/${subscriptionId}/status`,
    payload,
  )
  return data
}

export async function updateLicenseStatus(
  licenseId: number,
  payload: { status: string; reason?: string | null },
) {
  const { data } = await api.patch<License>(
    `/api/v1/admin/licenses/${licenseId}/status`,
    payload,
  )
  return data
}

export async function getShopOverrides(shopId: number) {
  const { data } = await api.get<ShopOverride[]>(`/api/v1/admin/shops/${shopId}/overrides`)
  return data
}

export async function createShopOverride(
  shopId: number,
  payload: {
    entitlement_id: number
    limit_value?: string | number | null
    is_unlimited?: boolean
    feature_enabled?: boolean | null
    reason?: string | null
  },
) {
  const { data } = await api.post<ShopOverride>(
    `/api/v1/admin/shops/${shopId}/overrides`,
    payload,
  )
  return data
}

export async function expireShopOverride(overrideId: number, reason?: string) {
  const { data } = await api.post<ShopOverride>(
    `/api/v1/admin/overrides/${overrideId}/expire`,
    { reason: reason || null },
  )
  return data
}

export async function recordSubscriptionPayment(payload: {
  shop_id: number
  plan_id: number
  amount: string | number
  currency: string
  billing_interval: string
  provider: string
  provider_payment_id: string
  provider_event_id?: string | null
  status: string
  reason?: string | null
}) {
  const { data } = await api.post<SubscriptionPayment>('/api/v1/admin/payments', payload)
  return data
}

export async function getSubscriptionPayments(shopId?: number) {
  const { data } = await api.get<SubscriptionPayment[]>('/api/v1/admin/payments', {
    params: { shop_id: shopId || undefined },
  })
  return data
}

export async function getPaymentGateways() {
  const { data } = await api.get<PaymentGatewayConfig[]>('/api/v1/admin/payment-gateways')
  return data
}

export async function savePaymentGateway(payload: {
  provider: string
  display_name: string
  key_id?: string | null
  key_secret?: string | null
  webhook_secret?: string | null
  settings?: Record<string, string | boolean | null>
  is_active: boolean
  is_test_mode: boolean
}) {
  const { data } = await api.post<PaymentGatewayConfig>('/api/v1/admin/payment-gateways', payload)
  return data
}

export async function reviewUpiPayment(paymentId: number, payload: {
  status: 'succeeded' | 'failed'
  reason?: string | null
}) {
  const { data } = await api.post(`/api/v1/admin/payments/${paymentId}/upi-review`, payload)
  return data
}
