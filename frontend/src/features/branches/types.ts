export type AccessibleBranch = {
  id: number
  name: string
  status: 'active'
  is_default_branch: boolean
  is_preferred: boolean
}

export type AccessibleBranchListResponse = {
  items: AccessibleBranch[]
}

export type ActiveBranchDetails = {
  id: number
  organization_id: number
  is_default_branch: boolean
  status: 'pending' | 'active' | 'inactive'
  name: string
  category: string
  email: string
  phone: string
  whatsapp_number: string | null
  address: string | null
  logo_url: string | null
  gst_enabled: boolean
  gstin: string | null
  state: string | null
  gst_state_code: string | null
  created_at: string
  updated_at: string
}
