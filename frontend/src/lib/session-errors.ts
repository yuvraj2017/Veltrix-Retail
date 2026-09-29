import { queryClient } from './queryClient'
import { clearTabSession, getTabToken } from './tab-session'

const AUTH_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
]
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password']

export function isAuthEndpoint(url: string) {
  return AUTH_PATHS.some((path) => new URL(url, window.location.origin).pathname === path)
}

export function handleSessionFailure(
  status: number | undefined,
  detail: unknown,
  url: string,
  requestToken: string | null,
) {
  const inactive = status === 403 && typeof detail === 'string' && detail.startsWith('account_inactive:')
  if (status !== 401 && !inactive) return
  // An old request must never sign out a subsequently logged-in account.
  if (!requestToken || requestToken !== getTabToken() || isAuthEndpoint(url)) return

  clearTabSession()
  queryClient.clear()
  if (!PUBLIC_ROUTES.includes(window.location.pathname)) window.location.replace('/')
}
