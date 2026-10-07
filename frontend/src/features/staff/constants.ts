import type { AssignableStaffRole, StaffMember, TenantRole } from './types'

export const PERMISSIONS = {
  dashboardView: 'dashboard.view',
  productsView: 'products.view',
  productsManage: 'products.manage',
  inventoryView: 'inventory.view',
  inventoryAdjust: 'inventory.adjust',
  inventoryCount: 'inventory.count',
  salesView: 'sales.view',
  salesCreate: 'sales.create',
  salesPayment: 'sales.payment',
  salesReturn: 'sales.return',
  salesRefund: 'sales.refund',
  salesCancel: 'sales.cancel',
  customersView: 'customers.view',
  customersManage: 'customers.manage',
  purchasingView: 'purchasing.view',
  purchasingManage: 'purchasing.manage',
  purchasingReceive: 'purchasing.receive',
  purchasingReturn: 'purchasing.return',
  vendorsView: 'vendors.view',
  vendorsManage: 'vendors.manage',
  payablesManage: 'payables.manage',
  payablesPayment: 'payables.payment',
  expensesView: 'expenses.view',
  expensesManage: 'expenses.manage',
  reportsView: 'reports.view',
  reportsExport: 'reports.export',
  auditView: 'audit.view',
  settingsView: 'settings.view',
  settingsManage: 'settings.manage',
  staffView: 'staff.view',
  staffManage: 'staff.manage',
  subscriptionView: 'subscription.view',
  subscriptionManage: 'subscription.manage',
  ownershipTransfer: 'ownership.transfer',
} as const

export const ROLE_LABELS: Record<TenantRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  inventory_manager: 'Inventory Manager',
  purchasing_manager: 'Purchasing Manager',
  report_viewer: 'Report Viewer',
}

const OWNER_ASSIGNABLE_ROLES: AssignableStaffRole[] = [
  'admin',
  'manager',
  'cashier',
  'inventory_manager',
  'purchasing_manager',
  'report_viewer',
]

const ADMIN_ASSIGNABLE_ROLES: AssignableStaffRole[] = [
  'manager',
  'cashier',
  'inventory_manager',
  'purchasing_manager',
  'report_viewer',
]

export function assignableRolesFor(actorRole?: string | null): AssignableStaffRole[] {
  if (actorRole === 'owner') return OWNER_ASSIGNABLE_ROLES
  if (actorRole === 'admin') return ADMIN_ASSIGNABLE_ROLES
  return []
}

export function canManageStaffTarget(
  actorRole: string | null | undefined,
  actorUserId: number | undefined,
  target: StaffMember,
) {
  if (!actorUserId || target.user_id === actorUserId || target.role === 'owner') return false
  if (actorRole === 'owner') return true
  return actorRole === 'admin' && target.role !== 'admin'
}

export function formatRole(role: string) {
  return ROLE_LABELS[role as TenantRole] ?? 'Unknown Role'
}

