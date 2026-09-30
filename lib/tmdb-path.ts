// TMDB content paths only use ids, slugs, and external ids (e.g. tt0137523, some.page).
// '%' is never allowed, so encoded separators or dot segments cannot be smuggled through,
// and pure-dot segments are rejected because URL parsing resolves them as '.'/'..'.
const SEGMENT = /^[A-Za-z0-9._-]{1,128}$/
const DOTS_ONLY = /^\.+$/
const MAX_SEGMENTS = 8

export function tmdbEndpoint(path: string[]) {
  const segments = path.filter(Boolean)
  if (
    !segments.length
    || segments.length > MAX_SEGMENTS
    || !segments.every(segment => SEGMENT.test(segment) && !DOTS_ONLY.test(segment))
  ) {
    return null
  }
  return { segments, endpoint: `/${segments.join('/')}` }
}

export function parseTmdbId(value: string) {
  if (!/^\d{1,10}$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
