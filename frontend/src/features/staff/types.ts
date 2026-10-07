export type TenantRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'inventory_manager'
  | 'purchasing_manager'
  | 'report_viewer'

export type AssignableStaffRole = Exclude<TenantRole, 'owner'>
export type MembershipStatus = 'active' | 'inactive'

export interface StaffBranchAccess {
  shop_id: number
  shop_name: string
  status: MembershipStatus
  is_current: boolean
}

export interface StaffMember {
  membership_id: number
  user_id: number
  full_name: string
  email: string
  role: TenantRole
  membership_status: MembershipStatus
  account_status: string
  active_shop_id: number | null
  branches: StaffBranchAccess[]
  created_at: string
  updated_at: string
}

export interface StaffCreatePayload {
  full_name: string
  email: string
  initial_password: string
  role: AssignableStaffRole
  branch_ids: number[]
  default_shop_id: number
}

export interface StaffUpdatePayload {
  role?: AssignableStaffRole
  status?: MembershipStatus
}

export interface OwnershipTransferResult {
  previous_owner: StaffMember
  new_owner: StaffMember
}

