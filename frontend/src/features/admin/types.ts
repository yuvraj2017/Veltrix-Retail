export type UserStatus = 'pending' | 'active' | 'rejected' | 'suspended' | 'disabled'

export type UserRole = 'owner' | 'super_admin'

export type AdminAuditAction =
  | 'USER_REGISTERED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_SUSPENDED'
  | 'USER_REACTIVATED'
  | 'USER_DISABLED'
  | 'ROLE_CHANGED'
  | 'PLAN_CHANGED'
  | 'ENTITLEMENT_CHANGED'
  | 'SUBSCRIPTION_CHANGED'
  | 'LICENSE_CHANGED'
  | 'SHOP_ENTITLEMENT_OVERRIDE_CHANGED'
  | 'PAYMENT_CHANGED'

/**
 * Trading figures for one shop. Cancelled invoices are excluded server-side,
 * matching the shop owner's own reports so the two views agree.
 *
 * All zeros for a super admin, who operates the platform and owns no shop.
 * Decimals arrive as strings from the API.
 */
export type ShopPerformance = {
  invoice_count: number
  total_revenue: string | number
  total_profit: string | number
  collected_amount: string | number
  outstanding_amount: string | number
  product_count: number
  customer_count: number
  last_invoice_date?: string | null
}

export type AdminUserListItem = ShopPerformance & {
  id: number
  full_name: string
  email: string
  phone?: string | null
  role: UserRole
  status: UserStatus

  /** Null for a super admin. */
  shop_id?: number | null
  shop_name?: string | null
  has_shop: boolean

  created_at: string
  last_login_at?: string | null
  /** Which states this account may legally move to next, computed server-side. */
  allowed_transitions: UserStatus[]
}

export type AdminUserListResponse = {
  items: AdminUserListItem[]
  total: number
  page: number
  page_size: number
}

export type AdminAuditEntry = {
  id: number
  action: AdminAuditAction
  actor_email: string
  actor_user_id?: number | null
  target_email?: string | null
  target_user_id?: number | null
  target_entity_type?: string | null
  target_entity_id?: number | null
  previous_value?: string | null
  new_value?: string | null
  reason?: string | null
  created_at: string
}

export type AdminUserDetail = ShopPerformance & {
  id: number
  full_name: string
  first_name?: string | null
  last_name?: string | null
  email: string
  phone?: string | null
  role: UserRole
  status: UserStatus
  status_reason?: string | null
  status_changed_at?: string | null
  profile_image_url?: string | null
  timezone?: string | null
  language?: string | null
  created_at: string
  updated_at: string
  last_login_at?: string | null

  shop_id?: number | null
  shop_name?: string | null
  shop_category?: string | null
  shop_email?: string | null
  shop_phone?: string | null
  shop_address?: string | null
  has_shop: boolean

  allowed_transitions: UserStatus[]
  can_change_role: boolean
  audit_trail: AdminAuditEntry[]
}

export type AdminRecentRegistrationPoint = {
  label: string
  day: string
  count: number
}

/** A shop ranked by revenue, named by its owner. */
export type AdminTopShopItem = {
  shop_id: number
  shop_name?: string | null
  owner_user_id?: number | null
  owner_name?: string | null
  owner_email?: string | null
  invoice_count: number
  total_revenue: string | number
  total_profit: string | number
}

export type AdminStats = {
  // Accounts
  total_users: number
  shop_owner_count: number
  super_admin_count: number
  pending_users: number
  active_users: number
  suspended_users: number
  rejected_users: number
  disabled_users: number
  total_shops: number

  // Signups
  registrations_last_7_days: number
  recent_registrations: AdminRecentRegistrationPoint[]

  // Trading across every shop on the platform
  platform_invoice_count: number
  platform_revenue: string | number
  platform_profit: string | number
  platform_collected: string | number
  platform_outstanding: string | number
  platform_revenue_last_7_days: string | number
  top_shops: AdminTopShopItem[]

  // Administrative activity
  admin_actions_last_7_days: number
  recent_activity: AdminAuditEntry[]
}

export type AdminActionResponse = {
  message: string
  user: AdminUserListItem
}

export type AdminAuditLogResponse = {
  items: AdminAuditEntry[]
  total: number
  page: number
  page_size: number
}

export type AdminUserListParams = {
  search?: string
  status?: UserStatus | ''
  role?: UserRole | ''
  sort_by?: string
  page?: number
  page_size?: number
}

export type AdminUserAction =
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'reactivate'
  | 'disable'

export type Plan = {
  id: number
  code: string
  name: string
  description?: string | null
  monthly_price: string | number
  annual_price: string | number
  currency: string
  trial_days: number
  grace_period_days: number
  is_active: boolean
  is_archived: boolean
  display_order: number
  created_at: string
  updated_at: string
  catalog_version_id?: number | null
  catalog_version_number?: number | null
  entitlements?: PlanEntitlement[]
}

export type EntitlementDefinition = {
  id: number
  key: string
  name: string
  description?: string | null
  kind: 'limit' | 'feature'
  value_type: string
  resource_key?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PlanEntitlement = {
  id: number
  plan_id: number
  entitlement_id: number
  entitlement_key: string
  entitlement_name: string
  kind: 'limit' | 'feature'
  resource_key?: string | null
  limit_value?: string | number | null
  is_unlimited: boolean
  feature_enabled?: boolean | null
  created_at: string
  updated_at: string
}

export type CatalogEntitlementSnapshot = {
  id: number
  entitlement_id: number
  entitlement_key: string
  entitlement_name: string
  kind: 'limit' | 'feature'
  value_type: string
  resource_key?: string | null
  limit_value?: string | number | null
  is_unlimited: boolean
  feature_enabled?: boolean | null
}

export type PlanCatalogVersion = {
  id: number
  plan_id: number
  version_number: number
  status: 'draft' | 'published'
  monthly_price: string | number
  annual_price: string | number
  currency: string
  trial_days: number
  grace_period_days: number
  published_at?: string | null
  published_by_user_id?: number | null
  entitlement_snapshots: CatalogEntitlementSnapshot[]
}

export type CatalogEntitlementInput = {
  entitlement_id: number
  limit_value?: string | number | null
  is_unlimited: boolean
  feature_enabled?: boolean | null
}

export type PlanCatalogPublishPayload = {
  expected_latest_version_number?: number | null
  monthly_price: string | number
  annual_price: string | number
  currency: string
  trial_days: number
  grace_period_days: number
  entitlements: CatalogEntitlementInput[]
}

export type PlanCreatePayload = {
  code: string
  name: string
  description?: string | null
  monthly_price: string | number
  annual_price: string | number
  currency: string
  trial_days: number
  grace_period_days: number
  is_active: boolean
  display_order: number
  entitlements: CatalogEntitlementInput[]
}

export type ShopSummary = {
  id: number
  name: string
  category: string
  email: string
  phone: string
  created_at: string
}

export type Subscription = {
  id: number
  shop_id: number
  plan_id: number
  catalog_version_id?: number | null
  plan?: Plan | null
  status: string
  billing_interval: string
  current_period_start?: string | null
  current_period_end?: string | null
  cancel_at?: string | null
  cancelled_at?: string | null
  provider?: string | null
  provider_customer_id?: string | null
  provider_subscription_id?: string | null
  created_at: string
  updated_at: string
}

export type License = {
  id: number
  shop_id: number
  subscription_id: number
  masked_key: string
  status: string
  issued_at: string
  activated_at?: string | null
  expires_at?: string | null
  revoked_at?: string | null
  created_at: string
  updated_at: string
}

export type UsageLimit = {
  key: string
  resource_key?: string | null
  configured: boolean
  source?: string | null
  is_unlimited: boolean
  limit_value?: string | number | null
  used?: number | null
  remaining?: string | number | null
  usage_supported: boolean
  over_limit: boolean
  code?: string | null
  message?: string | null
}

export type FeatureEntitlement = {
  key: string
  enabled: boolean
  configured: boolean
  source?: string | null
}

export type SubscriptionOverview = {
  shop_id: number
  plan?: Plan | null
  subscription?: Subscription | null
  license?: License | null
  limits: UsageLimit[]
  features: FeatureEntitlement[]
  access_allowed: boolean
  access_code?: string | null
  access_message?: string | null
}

export type ShopOverride = {
  id: number
  shop_id: number
  entitlement_id: number
  entitlement_key: string
  kind: 'limit' | 'feature'
  resource_key?: string | null
  limit_value?: string | number | null
  is_unlimited: boolean
  feature_enabled?: boolean | null
  reason?: string | null
  starts_at: string
  ends_at?: string | null
  created_by_user_id?: number | null
  created_at: string
  updated_at: string
}

export type SubscriptionPayment = {
  id: number
  shop_id: number
  subscription_id?: number | null
  provider: string
  provider_payment_id: string
  provider_order_id?: string | null
  provider_event_id?: string | null
  status: string
  amount: string | number
  currency: string
  billing_interval?: string | null
  paid_at?: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  customer_reference?: string | null
  reviewed_by_user_id?: number | null
  failure_reason?: string | null
  created_at: string
  updated_at: string
}

export type PaymentGatewayConfig = {
  id: number
  provider: string
  display_name: string
  key_id?: string | null
  key_secret_masked?: string | null
  webhook_secret_masked?: string | null
  settings: Record<string, string | boolean | null>
  is_active: boolean
  is_test_mode: boolean
  created_by_user_id?: number | null
  created_at: string
  updated_at: string
}
