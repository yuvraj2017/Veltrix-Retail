const TOKEN_KEY = 'access_token'
const USER_KEY = 'auth_user'

// Shared credentials cannot identify which account belonged to an existing tab.
// Require a fresh login instead of importing an arbitrary localStorage session.
export function removeLegacySharedSession() {
  const keys = [TOKEN_KEY, USER_KEY, 'token', 'authToken', 'veltrix_token', 'veltrix_access_token']
  try {
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Some browser privacy settings block localStorage independently.
  }
}

export function getTabToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getTabUser<T>(): T | null {
  if (!getTabToken()) return null
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    const user = raw ? JSON.parse(raw) : null
    return user && typeof user === 'object' && !Array.isArray(user) ? user : null
  } catch {
    sessionStorage.removeItem(USER_KEY)
    return null
  }
}

export function saveTabSession(token: string, user: unknown) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearTabSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  clearAllStoredBranchIds()
  setActiveBranchId(null)
}
import { setActiveBranchId } from './branch-runtime'
import { clearAllStoredBranchIds } from './branch-session'
