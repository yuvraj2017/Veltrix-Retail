export type ShopSettings = {
  id: number
  name: string
  category: string
  email: string
  phone: string
  whatsapp_number: string | null
  address: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}

export type UpdateShopPayload = {
  name: string
  category: string
  email: string
  phone: string
  whatsapp_number: string | null
  address: string | null
  logo_url: string | null
}

export type NotificationPreferences = {
  low_stock_alerts: boolean
  unpaid_invoice_alerts: boolean
  vendor_due_alerts: boolean
  weekly_digest: boolean
}

export type WorkspacePreferences = {
  default_reports_period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  default_reports_scope: 'keep-last' | 'reset-each-visit'
}
