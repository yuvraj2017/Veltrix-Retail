import type { CustomerPayload, LocalInvoiceItem } from '../features/billing/types'

const DRAFT_SCHEMA_VERSION = 1 as const
const LEGACY_DRAFT_KEY = 'billing_invoice_draft'
const LEGACY_MIGRATION_KEY = 'billing_invoice_draft:migration:v1'
const LEGACY_QUARANTINE_KEY = 'billing_invoice_draft:quarantine:v1'
const TAB_WRITER_KEY = 'billing_invoice_draft:writer:v1'

export type PosDraftData = {
  customer: CustomerPayload
  items: LocalInvoiceItem[]
  totalPayable: number
  isPayableManuallyEdited: boolean
  notes: string
  invoiceDate: string
  editInvoiceId: number | null
  clientRequestId: string
}

export type StoredPosDraft = {
  schemaVersion: typeof DRAFT_SCHEMA_VERSION
  userId: number
  organizationId: number
  branchId: number
  revision: number
  writerTabId: string
  updatedAt: string
  data: PosDraftData
}

export class PosDraftConflictError extends Error {
  constructor() {
    super('This branch draft was changed in another tab. Reload it before replacing those changes.')
  }
}

function storageKey(userId: number, organizationId: number, branchId: number) {
  return `billing_invoice_draft:v1:${userId}:${organizationId}:${branchId}`
}

function writerTabId() {
  let id = sessionStorage.getItem(TAB_WRITER_KEY)
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(TAB_WRITER_KEY, id)
  }
  return id
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isDraftData(value: unknown): value is PosDraftData {
  if (!isRecord(value) || !isRecord(value.customer) || !Array.isArray(value.items)) return false
  return (
    typeof value.totalPayable === 'number' &&
    Number.isFinite(value.totalPayable) &&
    typeof value.isPayableManuallyEdited === 'boolean' &&
    typeof value.notes === 'string' &&
    typeof value.invoiceDate === 'string' &&
    (value.editInvoiceId === null || typeof value.editInvoiceId === 'number') &&
    typeof value.clientRequestId === 'string' &&
    value.items.every((item) => isRecord(item) && typeof item.product_id === 'number' && typeof item.product_code === 'string')
  )
}

function parseStoredDraft(raw: string | null): StoredPosDraft | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.schemaVersion !== DRAFT_SCHEMA_VERSION || !isDraftData(value.data)) return null
    if (
      typeof value.userId !== 'number' ||
      typeof value.organizationId !== 'number' ||
      typeof value.branchId !== 'number' ||
      typeof value.revision !== 'number' ||
      typeof value.writerTabId !== 'string' ||
      typeof value.updatedAt !== 'string'
    ) return null
    return value as StoredPosDraft
  } catch {
    return null
  }
}

export function loadPosDraft(userId: number, organizationId: number, branchId: number) {
  const draft = parseStoredDraft(localStorage.getItem(storageKey(userId, organizationId, branchId)))
  if (!draft) return null
  if (draft.userId !== userId || draft.organizationId !== organizationId || draft.branchId !== branchId) return null
  return draft
}

export function savePosDraft(
  identity: { userId: number; organizationId: number; branchId: number },
  data: PosDraftData,
  expectedRevision: number | null,
) {
  const key = storageKey(identity.userId, identity.organizationId, identity.branchId)
  const existing = parseStoredDraft(localStorage.getItem(key))
  const tabId = writerTabId()
  if (existing && existing.writerTabId !== tabId && existing.revision !== expectedRevision) {
    throw new PosDraftConflictError()
  }
  const draft: StoredPosDraft = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    ...identity,
    revision: (existing?.revision ?? 0) + 1,
    writerTabId: tabId,
    updatedAt: new Date().toISOString(),
    data,
  }
  localStorage.setItem(key, JSON.stringify(draft))
  return draft
}

export function removePosDraft(userId: number, organizationId: number, branchId: number) {
  localStorage.removeItem(storageKey(userId, organizationId, branchId))
}

export function migrateLegacyPosDraft(identity: { userId: number; organizationId: number }, accessibleBranchIds: number[]) {
  if (localStorage.getItem(LEGACY_MIGRATION_KEY)) return { migratedBranchId: null, quarantined: false }
  const raw = localStorage.getItem(LEGACY_DRAFT_KEY)
  if (!raw) {
    localStorage.setItem(LEGACY_MIGRATION_KEY, 'none')
    return { migratedBranchId: null, quarantined: false }
  }

  try {
    const legacy: unknown = JSON.parse(raw)
    const value = isRecord(legacy) ? legacy : null
    const legacyUserId = Number(value?.user_id)
    const legacyOrganizationId = Number(value?.organization_id)
    const legacyBranchId = Number(value?.branch_id)
    const provable = (
      legacyUserId === identity.userId &&
      legacyOrganizationId === identity.organizationId &&
      accessibleBranchIds.includes(legacyBranchId)
    )

    if (provable && value) {
      const data: PosDraftData = {
        customer: (isRecord(value.customer) ? value.customer : {}) as CustomerPayload,
        items: Array.isArray(value.items) ? value.items as LocalInvoiceItem[] : [],
        totalPayable: Number(value.total_payable_amount ?? 0),
        isPayableManuallyEdited: true,
        notes: typeof value.notes === 'string' ? value.notes : '',
        invoiceDate: typeof value.invoice_date === 'string' ? value.invoice_date : new Date().toISOString().slice(0, 10),
        editInvoiceId: typeof value.edit_invoice_id === 'number' ? value.edit_invoice_id : null,
        clientRequestId: typeof value.client_request_id === 'string' ? value.client_request_id : '',
      }
      if (isDraftData(data)) savePosDraft({ ...identity, branchId: legacyBranchId }, data, null)
      else throw new Error('Legacy draft structure is invalid')
      localStorage.setItem(LEGACY_MIGRATION_KEY, `migrated:${legacyBranchId}`)
      localStorage.removeItem(LEGACY_DRAFT_KEY)
      return { migratedBranchId: legacyBranchId, quarantined: false }
    }
  } catch {
    // Ambiguous or malformed legacy data is quarantined below.
  }

  localStorage.setItem(LEGACY_QUARANTINE_KEY, raw)
  localStorage.setItem(LEGACY_MIGRATION_KEY, 'quarantined')
  localStorage.removeItem(LEGACY_DRAFT_KEY)
  return { migratedBranchId: null, quarantined: true }
}

export function hasQuarantinedLegacyPosDraft() {
  return localStorage.getItem(LEGACY_QUARANTINE_KEY) !== null
}

export function discardQuarantinedLegacyPosDraft() {
  localStorage.removeItem(LEGACY_QUARANTINE_KEY)
}

export function clearPosDraftTabState() {
  sessionStorage.removeItem(TAB_WRITER_KEY)
}
