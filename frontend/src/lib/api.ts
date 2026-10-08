import axios from 'axios'
import { handleSessionFailure, isAuthEndpoint } from './session-errors'
import { getTabToken } from './tab-session'
import {
  finishBranchMutation,
  getActiveBranchId,
  isBranchAccessFailure,
  isMutationMethod,
  notifyBranchAccessInvalid,
  shouldAttachBranchHeader,
  trackBranchMutation,
} from './branch-runtime'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
})

api.interceptors.request.use((config) => {
  const token = getTabToken()
  if (isAuthEndpoint(config.url ?? '')) config.headers.delete('Authorization')
  else if (!config.headers.has('Authorization') && token) config.headers.set('Authorization', `Bearer ${token}`)

  if (shouldAttachBranchHeader(config.url ?? '')) {
    const branchId = getActiveBranchId()
    if (!config.headers.has('X-Branch-ID') && branchId) {
      config.headers.set('X-Branch-ID', String(branchId))
    }
    if (isMutationMethod(config.method)) trackBranchMutation(config)
  } else {
    config.headers.delete('X-Branch-ID')
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    finishBranchMutation(response.config)
    const authorization = response.config.headers.get('Authorization')
    if (authorization && authorization !== `Bearer ${getTabToken()}`) {
      throw new axios.CanceledError('Session changed')
    }
    return response
  },
  (error) => {
    finishBranchMutation(error.config)
    const authorization = error.config?.headers?.get?.('Authorization')
    const requestToken = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : null
    handleSessionFailure(error.response?.status, error.response?.data?.detail, error.config?.url ?? '', requestToken)
    if (
      error.config?.headers?.get?.('X-Branch-ID') &&
      new URL(error.config?.url ?? '', window.location.origin).pathname !== '/api/v1/branches' &&
      isBranchAccessFailure(error.response?.status, error.response?.data?.detail)
    ) {
      notifyBranchAccessInvalid()
    }
    return Promise.reject(error)
  },
)
