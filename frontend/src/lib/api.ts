import axios from 'axios'
import { handleSessionFailure, isAuthEndpoint } from './session-errors'
import { getTabToken } from './tab-session'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
})

api.interceptors.request.use((config) => {
  const token = getTabToken()
  if (isAuthEndpoint(config.url ?? '')) config.headers.delete('Authorization')
  else if (!config.headers.has('Authorization') && token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(
  (response) => {
    const authorization = response.config.headers.get('Authorization')
    if (authorization && authorization !== `Bearer ${getTabToken()}`) {
      throw new axios.CanceledError('Session changed')
    }
    return response
  },
  (error) => {
    const authorization = error.config?.headers?.get?.('Authorization')
    const requestToken = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : null
    handleSessionFailure(error.response?.status, error.response?.data?.detail, error.config?.url ?? '', requestToken)
    return Promise.reject(error)
  },
)
