type CacheEntry<T> = {
  value: T
  updatedAt: number
}

const resourceCache = new Map<string, CacheEntry<unknown>>()

export function getCachedResource<T>(key: string, maxAgeMs: number) {
  const entry = resourceCache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null

  if (Date.now() - entry.updatedAt > maxAgeMs) {
    resourceCache.delete(key)
    return null
  }

  return entry.value
}

export function setCachedResource<T>(key: string, value: T) {
  resourceCache.set(key, {
    value,
    updatedAt: Date.now(),
  })

  return value
}

export function clearCachedResource(key: string) {
  resourceCache.delete(key)
}

export function clearCachedResourcePrefix(prefix: string) {
  for (const key of resourceCache.keys()) {
    if (key.startsWith(prefix)) {
      resourceCache.delete(key)
    }
  }
}
