const BRANCH_KEY_PREFIX = 'active_branch:'

export function branchStorageKey(userId: number, organizationId: number) {
  return `${BRANCH_KEY_PREFIX}${userId}:${organizationId}`
}

export function getStoredBranchId(userId: number, organizationId: number) {
  try {
    const value = sessionStorage.getItem(branchStorageKey(userId, organizationId))
    if (!value || !/^\d+$/.test(value)) return null
    const branchId = Number(value)
    return Number.isSafeInteger(branchId) && branchId > 0 ? branchId : null
  } catch {
    return null
  }
}

export function saveStoredBranchId(userId: number, organizationId: number, branchId: number) {
  sessionStorage.setItem(branchStorageKey(userId, organizationId), String(branchId))
}

export function clearStoredBranchId(userId: number, organizationId: number) {
  sessionStorage.removeItem(branchStorageKey(userId, organizationId))
}

export function clearAllStoredBranchIds() {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(BRANCH_KEY_PREFIX)) sessionStorage.removeItem(key)
    }
  } catch {
    // Session cleanup remains best-effort in privacy-restricted browsers.
  }
}
