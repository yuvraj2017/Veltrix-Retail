import { handleSessionFailure } from './session-errors'
import { getTabToken } from './tab-session'

export async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getTabToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  else headers.delete('Authorization')

  const response = await fetch(url, { ...init, headers })
  if (token !== getTabToken()) throw new DOMException('Session changed', 'AbortError')

  if (response.status === 401 || response.status === 403) {
    const data = await response.clone().json().catch(() => null)
    handleSessionFailure(response.status, data?.detail, url, token)
  }
  return response
}
