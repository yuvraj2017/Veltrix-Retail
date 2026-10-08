import { handleSessionFailure } from './session-errors'
import { getTabToken } from './tab-session'
import {
  beginBranchMutation,
  getActiveBranchId,
  isBranchAccessFailure,
  isMutationMethod,
  notifyBranchAccessInvalid,
  shouldAttachBranchHeader,
} from './branch-runtime'

export async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getTabToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  else headers.delete('Authorization')

  if (shouldAttachBranchHeader(url)) {
    const branchId = getActiveBranchId()
    if (!headers.has('X-Branch-ID') && branchId) headers.set('X-Branch-ID', String(branchId))
  } else {
    headers.delete('X-Branch-ID')
  }

  const finishMutation = shouldAttachBranchHeader(url) && isMutationMethod(init.method)
    ? beginBranchMutation()
    : null

  try {
    const response = await fetch(url, { ...init, headers })
    if (token !== getTabToken()) throw new DOMException('Session changed', 'AbortError')

    if (response.status === 401 || response.status === 403) {
      const data = await response.clone().json().catch(() => null)
      handleSessionFailure(response.status, data?.detail, url, token)
      if (
        headers.has('X-Branch-ID') &&
        new URL(url, window.location.origin).pathname !== '/api/v1/branches' &&
        isBranchAccessFailure(response.status, data?.detail)
      ) {
        notifyBranchAccessInvalid()
      }
    }
    return response
  } finally {
    finishMutation?.()
  }
}
