export const SEARCH_MAPPING_PATH = '/search/manual'
export const SEARCH_CAPTURE_PATH = '/search/captured'
export const SEARCH_CAPTURE_SOURCE_PATHS = ['/search/multi', '/search/movie', '/search/tv'] as const
export const MAX_TMDB_CACHE_KEY_LENGTH = 512

export type SearchMediaType = 'movie' | 'tv'
export type SearchCaptureSourcePath = (typeof SEARCH_CAPTURE_SOURCE_PATHS)[number]

export type SearchCapture = {
  query: string
  path: SearchCaptureSourcePath
  dismissed?: boolean
  occurrences?: number
  firstSeen?: string
  lastSeen?: string
}

type SearchItem = {
  id: number
  media_type: SearchMediaType
  [key: string]: unknown
}

export type ManualSearchMapping = {
  query: string
  mediaType: SearchMediaType
  tmdbId: number
  item: SearchItem
}

export function normalizeSearchQuery(query: string) {
  return query.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function manualSearchCacheQuery(query: string) {
  return `query=${encodeURIComponent(normalizeSearchQuery(query))}`
}

export function manualSearchCacheKey(query: string) {
  return `${SEARCH_MAPPING_PATH}?${manualSearchCacheQuery(query)}`
}

export function searchCaptureCacheKey(query: string) {
  return `${SEARCH_CAPTURE_PATH}?${manualSearchCacheQuery(query)}`
}

export function isSearchCaptureSourcePath(path: string): path is SearchCaptureSourcePath {
  return SEARCH_CAPTURE_SOURCE_PATHS.includes(path as SearchCaptureSourcePath)
}

export function parseSearchCapture(payload: unknown): SearchCapture | null {
  if (!payload || typeof payload !== 'object') return null
  const capture = payload as Partial<SearchCapture>
  if (
    typeof capture.query !== 'string'
    || !normalizeSearchQuery(capture.query)
    || typeof capture.path !== 'string'
    || !isSearchCaptureSourcePath(capture.path)
    || (capture.dismissed !== undefined && typeof capture.dismissed !== 'boolean')
    || (capture.occurrences !== undefined && (!Number.isInteger(capture.occurrences) || capture.occurrences < 1))
    || (capture.firstSeen !== undefined && Number.isNaN(Date.parse(capture.firstSeen)))
    || (capture.lastSeen !== undefined && Number.isNaN(Date.parse(capture.lastSeen)))
  ) {
    return null
  }
  return capture as SearchCapture
}

export function parseManualSearchMapping(payload: unknown): ManualSearchMapping | null {
  if (!payload || typeof payload !== 'object') return null

  const mapping = payload as Partial<ManualSearchMapping>
  if (
    typeof mapping.query !== 'string'
    || (mapping.mediaType !== 'movie' && mapping.mediaType !== 'tv')
    || !Number.isInteger(mapping.tmdbId)
    || !mapping.item
    || typeof mapping.item !== 'object'
    || mapping.item.id !== mapping.tmdbId
    || mapping.item.media_type !== mapping.mediaType
  ) {
    return null
  }

  return mapping as ManualSearchMapping
}

export function applyManualSearchMapping(
  payload: unknown,
  mapping: ManualSearchMapping | null,
  expectedMediaType?: SearchMediaType,
) {
  if (!mapping || (expectedMediaType && mapping.mediaType !== expectedMediaType)) return payload
  if (!payload || typeof payload !== 'object') return payload

  const source = payload as {
    results?: unknown
    total_results?: unknown
    total_pages?: unknown
    [key: string]: unknown
  }
  const results = Array.isArray(source.results) ? source.results : []
  const duplicate = results.some((item) => {
    if (!item || typeof item !== 'object') return false
    const result = item as { id?: unknown; media_type?: unknown }
    return result.id === mapping.tmdbId
      && (!result.media_type || result.media_type === mapping.mediaType)
  })
  const item = expectedMediaType
    ? Object.fromEntries(Object.entries(mapping.item).filter(([key]) => key !== 'media_type'))
    : mapping.item
  const mappedResults = [
    item,
    ...results.filter((result) => {
      if (!result || typeof result !== 'object') return true
      const existing = result as { id?: unknown; media_type?: unknown }
      return existing.id !== mapping.tmdbId
        || Boolean(existing.media_type && existing.media_type !== mapping.mediaType)
    }),
  ]
  const totalResults = typeof source.total_results === 'number' ? source.total_results : results.length

  return {
    ...source,
    results: mappedResults,
    total_results: totalResults + (duplicate ? 0 : 1),
    total_pages: Math.max(typeof source.total_pages === 'number' ? source.total_pages : 0, 1),
  }
}

export function manualSearchMappingApplies(
  mapping: ManualSearchMapping | null,
  expectedMediaType?: SearchMediaType,
) {
  return Boolean(mapping && (!expectedMediaType || mapping.mediaType === expectedMediaType))
}

export function tmdbSearchResponseHeaders(
  cacheStatus: 'hit' | 'miss' | 'bypass',
  mapping: ManualSearchMapping | null,
  expectedMediaType?: SearchMediaType,
) {
  return {
    'x-tmdb-cache': cacheStatus,
    ...(manualSearchMappingApplies(mapping, expectedMediaType) && { 'x-tmdb-search-mapped': 'true' }),
  }
}

export function isUnresolvedSearchPayload(path: string, payload: unknown) {
  if (!payload || typeof payload !== 'object') return false
  const results = (payload as { results?: unknown }).results
  if (!Array.isArray(results)) return false
  if (path !== '/search/multi') return results.length === 0

  return !results.some((item) => {
    if (!item || typeof item !== 'object') return false
    const mediaType = (item as { media_type?: unknown }).media_type
    return mediaType === 'movie' || mediaType === 'tv'
  })
}
