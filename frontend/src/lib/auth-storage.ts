const TOKEN_KEY = 'auth_token'
const STORAGE_TYPE_KEY = 'auth_storage_type'

type StorageType = 'local' | 'session'

function getStorage(type: StorageType) {
  return type === 'local' ? localStorage : sessionStorage
}

export function saveToken(token: string, remember = true) {
  const type: StorageType = remember ? 'local' : 'session'
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.setItem(STORAGE_TYPE_KEY, type)
  getStorage(type).setItem(TOKEN_KEY, token)
}

export function getToken() {
  const type = (localStorage.getItem(STORAGE_TYPE_KEY) || 'local') as StorageType
  return getStorage(type).getItem(TOKEN_KEY)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(STORAGE_TYPE_KEY)
}