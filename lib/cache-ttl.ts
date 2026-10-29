const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// Local list/search results change as lazy-sync adds rows, so clients only reuse them briefly.
export const LOCAL_LIST_CACHE_CONTROL = 'private, max-age=60'

// Normalized Movie/TvShow rows and TMDB detail responses.
export const DETAIL_TTL_MS = 3 * DAY_MS

const LIST_SEGMENTS = new Set(['popular', 'now_playing', 'upcoming', 'top_rated', 'airing_today', 'on_the_air'])
const REFERENCE_ROOTS = new Set(['configuration', 'genre', 'certification', 'watch'])
// Browser/client cache lifetime ceiling; the server-side TTL controls when TMDB is asked again.
const MAX_CLIENT_CACHE_SECONDS = 60 * 60
const MIN_CLIENT_CACHE_SECONDS = 60

// How long a cached TMDB response stays fresh before it is served stale and refetched in the background.
export function tmdbCacheTtlMs(endpoint: string) {
  const [root, second] = endpoint.split('/').filter(Boolean)

  if (root === 'trending' || second === 'latest') return HOUR_MS
  if (root === 'discover' || LIST_SEGMENTS.has(second || '')) return 6 * HOUR_MS
  if (root === 'search' || root === 'find') return DAY_MS
  if (REFERENCE_ROOTS.has(root || '')) return 7 * DAY_MS
  return DETAIL_TTL_MS
}

export function cacheAgeMs(updatedAt: Date, now = Date.now()) {
  return Math.max(0, now - updatedAt.getTime())
}

export function isCacheStale(updatedAt: Date, ttlMs: number, now = Date.now()) {
  return cacheAgeMs(updatedAt, now) >= ttlMs
}

// `private` keeps shared caches (Cloudflare, Caddy) from serving key-gated responses without
// the API-key check and usage logging; API clients may still reuse the response locally.
export function privateCacheControl(ttlMs: number, updatedAt: Date | null = null, now = Date.now()) {
  const remainingMs = updatedAt ? ttlMs - cacheAgeMs(updatedAt, now) : ttlMs
  const seconds = Math.min(
    MAX_CLIENT_CACHE_SECONDS,
    Math.max(MIN_CLIENT_CACHE_SECONDS, Math.floor(remainingMs / 1000)),
  )
  return `private, max-age=${seconds}`
}
