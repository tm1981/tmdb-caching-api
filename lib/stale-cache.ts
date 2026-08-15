type CacheEntry<Value> = {
  value?: Value
  expiresAt: number
  refresh: Promise<Value> | null
}

type StaleCacheOptions = {
  freshMs: number
  now?: () => number
  onRefreshError?: (error: unknown) => void
}

export function createStaleWhileRevalidateCache<Key, Value>({
  freshMs,
  now = Date.now,
  onRefreshError = error => console.warn('Background cache refresh failed:', error),
}: StaleCacheOptions) {
  const entries = new Map<Key, CacheEntry<Value>>()

  function refresh(key: Key, load: () => Promise<Value>) {
    const entry = entries.get(key) || { expiresAt: 0, refresh: null }
    if (entry.refresh) return entry.refresh

    entry.refresh = load()
      .then(value => {
        entry.value = value
        entry.expiresAt = now() + freshMs
        return value
      })
      .finally(() => {
        entry.refresh = null
      })
    entries.set(key, entry)
    return entry.refresh
  }

  async function get(key: Key, load: () => Promise<Value>) {
    const entry = entries.get(key)
    if (entry?.value !== undefined && entry.expiresAt > now()) return entry.value

    if (entry?.value !== undefined) {
      void refresh(key, load).catch(onRefreshError)
      return entry.value
    }

    return refresh(key, load)
  }

  return {
    get,
    clear: () => entries.clear(),
  }
}
