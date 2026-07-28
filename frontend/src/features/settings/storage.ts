import type { NotificationPreferences, WorkspacePreferences } from './types'

export const WORKSPACE_PREFERENCES_KEY = 'retailflow.workspace_preferences'
export const NOTIFICATION_PREFERENCES_KEY = 'retailflow.notification_preferences'
export const LAST_REPORTS_PERIOD_KEY = 'retailflow.last_reports_period'

export const defaultWorkspacePreferences: WorkspacePreferences = {
  default_reports_period: 'monthly',
  default_reports_scope: 'keep-last',
}

export const defaultNotificationPreferences: NotificationPreferences = {
  low_stock_alerts: true,
  unpaid_invoice_alerts: true,
  vendor_due_alerts: true,
  weekly_digest: false,
}

function parseStoredValue<T>(value: string | null, fallback: T): T {
  if (!value) return fallback

  try {
    return { ...fallback, ...JSON.parse(value) }
  } catch {
    return fallback
  }
}

export function loadWorkspacePreferences() {
  return parseStoredValue(
    localStorage.getItem(WORKSPACE_PREFERENCES_KEY),
    defaultWorkspacePreferences,
  )
}

export function saveWorkspacePreferences(value: WorkspacePreferences) {
  localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(value))
}

export function loadNotificationPreferences() {
  return parseStoredValue(
    localStorage.getItem(NOTIFICATION_PREFERENCES_KEY),
    defaultNotificationPreferences,
  )
}

export function saveNotificationPreferences(value: NotificationPreferences) {
  localStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(value))
}

export function loadActiveReportsPeriod() {
  const workspace = loadWorkspacePreferences()

  if (workspace.default_reports_scope === 'keep-last') {
    const lastPeriod = localStorage.getItem(LAST_REPORTS_PERIOD_KEY)
    if (lastPeriod === 'weekly' || lastPeriod === 'monthly' || lastPeriod === 'quarterly' || lastPeriod === 'yearly') {
      return lastPeriod
    }
  }

  return workspace.default_reports_period
}

export function saveActiveReportsPeriod(period: WorkspacePreferences['default_reports_period']) {
  localStorage.setItem(LAST_REPORTS_PERIOD_KEY, period)
}
