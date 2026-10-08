const invalidBranchDetail = 'Tenant membership is inactive or unavailable'

let activeBranchId: number | null = null
let pendingBranchMutations = 0

const mutationListeners = new Set<() => void>()
const invalidBranchListeners = new Set<() => void>()
const trackedMutations = new WeakSet<object>()

function pathnameFor(url: string) {
  try {
    return new URL(url, window.location.origin).pathname
  } catch {
    return url
  }
}

export function shouldAttachBranchHeader(url: string) {
  const pathname = pathnameFor(url)
  const tenantApi = pathname.startsWith('/api/v1/') || pathname.startsWith('/customer-analytics/')
  if (!tenantApi) return false

  return ![
    '/api/v1/admin',
    '/api/v1/auth',
    '/api/v1/profile',
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function getActiveBranchId() {
  return activeBranchId
}

export function setActiveBranchId(branchId: number | null) {
  activeBranchId = branchId
}

export function isMutationMethod(method?: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method || 'GET').toUpperCase())
}

function emitMutationChange() {
  mutationListeners.forEach((listener) => listener())
}

export function trackBranchMutation(request: object) {
  if (trackedMutations.has(request)) return
  trackedMutations.add(request)
  pendingBranchMutations += 1
  emitMutationChange()
}

export function finishBranchMutation(request: object | undefined) {
  if (!request || !trackedMutations.delete(request)) return
  pendingBranchMutations = Math.max(0, pendingBranchMutations - 1)
  emitMutationChange()
}

export function beginBranchMutation() {
  const marker = {}
  trackBranchMutation(marker)
  return () => finishBranchMutation(marker)
}

export function getPendingBranchMutationCount() {
  return pendingBranchMutations
}

export function subscribeToBranchMutations(listener: () => void) {
  mutationListeners.add(listener)
  return () => {
    mutationListeners.delete(listener)
  }
}

export function isBranchAccessFailure(status: number | undefined, detail: unknown) {
  return status === 403 && detail === invalidBranchDetail
}

export function notifyBranchAccessInvalid() {
  invalidBranchListeners.forEach((listener) => listener())
}

export function subscribeToInvalidBranch(listener: () => void) {
  invalidBranchListeners.add(listener)
  return () => {
    invalidBranchListeners.delete(listener)
  }
}
