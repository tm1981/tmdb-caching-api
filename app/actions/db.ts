'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { hashApiKey } from '@/lib/api-keys'
import { getDatabaseProvider } from '@/lib/database-provider'
import { validIpAddress } from '@/lib/ip-address'
import prisma from '@/lib/prisma'
import { paginationParams } from '@/lib/pagination'
import { clearUsageDashboardCache } from '@/lib/usage-dashboard'
import { getCachedTmdb, setSearchCaptureDismissed, upsertTmdbCache } from '@/lib/tmdb-cache'
import {
  clearCachedData,
  getCachedDataCounts,
  PRESERVED_TMDB_CACHE_PATHS,
  scheduleCachedDataLimitEnforcement,
  TMDB_CACHE_MAX_ROWS,
} from '@/lib/cache-limit'
import {
  isUnresolvedSearchPayload,
  manualSearchCacheKey,
  manualSearchCacheQuery,
  MAX_TMDB_CACHE_KEY_LENGTH,
  normalizeSearchQuery,
  parseSearchCapture,
  parseManualSearchMapping,
  searchCaptureCacheKey,
  isSearchCaptureSourcePath,
  SEARCH_CAPTURE_PATH,
  SEARCH_MAPPING_PATH,
  type ManualSearchMapping,
  type SearchMediaType,
} from '@/lib/search-mappings'
import {
  searchMovie,
  searchTv,
  getMovieDetails,
  getTvDetails,
  getTrendingMovies,
  getTrendingTv,
  getTopRatedMovies,
  getTopRatedTv,
  extractMovieData,
  extractTvDataFull,
} from '@/lib/tmdb'

// Movies
export async function getMovies(page = 1, limit = 20, query = '') {
  await requireAdmin()
  const pagination = paginationParams(page, limit)

  const where: any = {}
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { originalTitle: { contains: query } },
    ]
  }

  const [movies, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { title: 'asc' },
    }),
    prisma.movie.count({ where }),
  ])

  return { movies, total, totalPages: Math.ceil(total / pagination.limit) }
}

export async function getMovieById(id: number) {
  await requireAdmin()
  return prisma.movie.findUnique({
    where: { tmdbId: id },
  })
}

export async function deleteMovie(tmdbId: number) {
  await requireAdmin()
  await prisma.movie.delete({
    where: { tmdbId },
  })
  revalidatePath('/admin/movies')
}

// TV Shows
export async function getTvShows(page = 1, limit = 20, query = '') {
  await requireAdmin()
  const pagination = paginationParams(page, limit)

  const where: any = {}
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { originalName: { contains: query } },
    ]
  }

  const [tvShows, total] = await Promise.all([
    prisma.tvShow.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { name: 'asc' },
    }),
    prisma.tvShow.count({ where }),
  ])

  return { tvShows, total, totalPages: Math.ceil(total / pagination.limit) }
}

export async function getTvShowById(id: number) {
  await requireAdmin()
  return prisma.tvShow.findUnique({
    where: { tmdbId: id },
  })
}

export async function deleteTvShow(tmdbId: number) {
  await requireAdmin()
  await prisma.tvShow.delete({
    where: { tmdbId },
  })
  revalidatePath('/admin/tv')
}

// Search fixes
export type SearchFixTab = 'unresolved' | 'dismissed' | 'mappings'
export type SearchFixSort = 'frequent' | 'recent' | 'oldest' | 'query'

export type SearchFixItem = {
  query: string
  path: string
  capturedAt: Date
  firstSeen: Date
  occurrences: number
}

export type SearchFixMappingItem = ManualSearchMapping & {
  updatedAt: Date
}

export type SearchFixesOptions = {
  tab?: SearchFixTab
  q?: string
  page?: number
  pageSize?: number
  sort?: SearchFixSort
}

export type SearchFixesResult = {
  counts: {
    unresolved: number
    dismissed: number
    mappings: number
  }
  tab: SearchFixTab
  page: number
  pageSize: number
  total: number
  totalPages: number
  unresolved: SearchFixItem[]
  dismissed: SearchFixItem[]
  mappings: SearchFixMappingItem[]
}

export function buildSearchRedirectUrl(statusKey: string, formData?: FormData) {
  const params = new URLSearchParams()
  params.set(statusKey, '1')
  if (formData) {
    const returnTab = formData.get('returnTab')
    const returnPage = formData.get('returnPage')
    const returnQ = formData.get('returnQ')
    const returnSort = formData.get('returnSort')
    const returnPageSize = formData.get('returnPageSize')

    if (returnTab && typeof returnTab === 'string') params.set('tab', returnTab)
    if (returnPage && typeof returnPage === 'string' && returnPage !== '1') params.set('page', returnPage)
    if (returnQ && typeof returnQ === 'string' && returnQ.trim()) params.set('q', returnQ.trim())
    if (returnSort && typeof returnSort === 'string') params.set('sort', returnSort)
    if (returnPageSize && typeof returnPageSize === 'string' && returnPageSize !== '50') params.set('pageSize', returnPageSize)
  }
  return `/admin/search?${params.toString()}`
}

export function buildSearchErrorRedirectUrl(errorMessage: string, formData?: FormData) {
  const url = buildSearchRedirectUrl('dummy', formData)
  const [base, query] = url.split('?')
  const params = new URLSearchParams(query)
  params.delete('dummy')
  params.set('error', errorMessage)
  return `${base}?${params.toString()}`
}

export async function getSearchFixes(options?: SearchFixesOptions): Promise<SearchFixesResult> {
  await requireAdmin()
  const [searches, captureRows, mappingRows] = await Promise.all([
    prisma.tmdbCache.findMany({
      where: { path: { in: ['/search/multi', '/search/movie', '/search/tv'] } },
      take: 100,
      orderBy: { updatedAt: 'desc' },
      select: { path: true, query: true, payload: true, updatedAt: true },
    }),
    prisma.tmdbCache.findMany({
      where: { path: SEARCH_CAPTURE_PATH },
      orderBy: { updatedAt: 'desc' },
      select: { payload: true, updatedAt: true },
    }),
    prisma.tmdbCache.findMany({
      where: { path: SEARCH_MAPPING_PATH },
      orderBy: { updatedAt: 'desc' },
      select: { payload: true, updatedAt: true },
    }),
  ])

  const mappings: SearchFixMappingItem[] = mappingRows.flatMap((row) => {
    const mapping = parseManualSearchMapping(row.payload)
    return mapping ? [{ ...mapping, updatedAt: row.updatedAt }] : []
  })
  const mappedQueries = new Set(mappings.map((mapping) => normalizeSearchQuery(mapping.query)))
  const unresolved = new Map<string, SearchFixItem>()

  const dismissedQueries = new Set<string>()
  const dismissed: SearchFixItem[] = []
  for (const row of captureRows) {
    const capture = parseSearchCapture(row.payload)
    if (!capture) continue
    const normalized = normalizeSearchQuery(capture.query)
    const capturedAt = capture.lastSeen ? new Date(capture.lastSeen) : row.updatedAt
    const firstSeen = capture.firstSeen ? new Date(capture.firstSeen) : row.updatedAt
    const item: SearchFixItem = {
      query: capture.query,
      path: capture.path,
      capturedAt,
      firstSeen,
      occurrences: capture.occurrences || 1,
    }
    if (capture.dismissed) {
      dismissedQueries.add(normalized)
      dismissed.push(item)
    } else if (!mappedQueries.has(normalized)) {
      unresolved.set(normalized, item)
    }
  }

  for (const search of searches) {
    const query = new URLSearchParams(search.query).get('query')?.trim()
    const normalized = query ? normalizeSearchQuery(query) : ''
    if (
      !query
      || !normalized
      || mappedQueries.has(normalized)
      || dismissedQueries.has(normalized)
      || unresolved.has(normalized)
      || !isUnresolvedSearchPayload(search.path, search.payload)
    ) {
      continue
    }
    unresolved.set(normalized, {
      query,
      path: search.path,
      capturedAt: search.updatedAt,
      firstSeen: search.updatedAt,
      occurrences: 1,
    })
  }

  const allUnresolved = [...unresolved.values()]
  const allDismissed = dismissed
  const allMappings = mappings

  const counts = {
    unresolved: allUnresolved.length,
    dismissed: allDismissed.length,
    mappings: allMappings.length,
  }

  const activeTab: SearchFixTab = options?.tab && ['unresolved', 'dismissed', 'mappings'].includes(options.tab)
    ? options.tab
    : 'unresolved'

  const defaultSort: SearchFixSort = activeTab === 'unresolved' ? 'frequent' : 'recent'
  const sort: SearchFixSort = options?.sort && ['frequent', 'recent', 'oldest', 'query'].includes(options.sort)
    ? options.sort
    : defaultSort

  const filterText = options?.q?.trim().toLowerCase()

  let filteredUnresolved = allUnresolved
  let filteredDismissed = allDismissed
  let filteredMappings = allMappings

  if (filterText) {
    filteredUnresolved = allUnresolved.filter((item) =>
      item.query.toLowerCase().includes(filterText) || item.path.toLowerCase().includes(filterText)
    )
    filteredDismissed = allDismissed.filter((item) =>
      item.query.toLowerCase().includes(filterText) || item.path.toLowerCase().includes(filterText)
    )
    filteredMappings = allMappings.filter((item) => {
      const title = typeof item.item?.title === 'string'
        ? item.item.title
        : typeof item.item?.name === 'string'
          ? item.item.name
          : ''
      return (
        item.query.toLowerCase().includes(filterText)
        || title.toLowerCase().includes(filterText)
        || String(item.tmdbId).includes(filterText)
      )
    })
  }

  const sortCaptures = (items: SearchFixItem[]) => {
    return [...items].sort((a, b) => {
      if (sort === 'frequent') {
        return b.occurrences - a.occurrences || b.capturedAt.getTime() - a.capturedAt.getTime()
      }
      if (sort === 'recent') {
        return b.capturedAt.getTime() - a.capturedAt.getTime()
      }
      if (sort === 'oldest') {
        return a.firstSeen.getTime() - b.firstSeen.getTime()
      }
      if (sort === 'query') {
        return a.query.localeCompare(b.query)
      }
      return 0
    })
  }

  const sortMappings = (items: SearchFixMappingItem[]) => {
    return [...items].sort((a, b) => {
      if (sort === 'recent') {
        return b.updatedAt.getTime() - a.updatedAt.getTime()
      }
      if (sort === 'oldest') {
        return a.updatedAt.getTime() - b.updatedAt.getTime()
      }
      if (sort === 'query') {
        return a.query.localeCompare(b.query)
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })
  }

  const sortedUnresolved = sortCaptures(filteredUnresolved)
  const sortedDismissed = sortCaptures(filteredDismissed)
  const sortedMappings = sortMappings(filteredMappings)

  if (!options) {
    return {
      counts,
      tab: 'unresolved',
      page: 1,
      pageSize: counts.unresolved || 1,
      total: counts.unresolved,
      totalPages: 1,
      unresolved: sortedUnresolved,
      dismissed: sortedDismissed,
      mappings: sortedMappings,
    }
  }

  const targetTotal = activeTab === 'unresolved'
    ? sortedUnresolved.length
    : activeTab === 'dismissed'
      ? sortedDismissed.length
      : sortedMappings.length

  const pageSize = Math.max(10, Math.min(200, options.pageSize || 50))
  const totalPages = Math.max(1, Math.ceil(targetTotal / pageSize))
  const page = Math.max(1, Math.min(totalPages, options.page || 1))
  const offset = (page - 1) * pageSize

  return {
    counts,
    tab: activeTab,
    page,
    pageSize,
    total: targetTotal,
    totalPages,
    unresolved: activeTab === 'unresolved' ? sortedUnresolved.slice(offset, offset + pageSize) : [],
    dismissed: activeTab === 'dismissed' ? sortedDismissed.slice(offset, offset + pageSize) : [],
    mappings: activeTab === 'mappings' ? sortedMappings.slice(offset, offset + pageSize) : [],
  }
}

type MappingCandidatePayload = {
  results?: Array<{
    id?: number
    title?: string
    original_title?: string
    name?: string
    original_name?: string
    poster_path?: string | null
    release_date?: string | null
    first_air_date?: string | null
    vote_average?: number | null
  }>
}

export async function searchTmdbMappingCandidates(query: string) {
  await requireAdmin()
  const cleanQuery = query.trim().slice(0, 200)
  if (!cleanQuery) return []

  const params = { query: cleanQuery, page: 1, language: 'en-US', include_adult: 'false' }
  const [movies, tv] = await Promise.all([
    getCachedTmdb<MappingCandidatePayload>('/search/movie', params),
    getCachedTmdb<MappingCandidatePayload>('/search/tv', params),
  ])

  return [
    ...(movies.cache === 'bypass' ? [] : movies.payload.results || []).slice(0, 6).flatMap(item => (
      Number.isInteger(item.id) && item.title
        ? [{
            tmdbId: item.id as number,
            mediaType: 'movie' as const,
            title: item.title,
            originalTitle: item.original_title || item.title,
            posterPath: item.poster_path || null,
            date: item.release_date || null,
            voteAverage: item.vote_average ?? null,
          }]
        : []
    )),
    ...(tv.cache === 'bypass' ? [] : tv.payload.results || []).slice(0, 6).flatMap(item => (
      Number.isInteger(item.id) && item.name
        ? [{
            tmdbId: item.id as number,
            mediaType: 'tv' as const,
            title: item.name,
            originalTitle: item.original_name || item.name,
            posterPath: item.poster_path || null,
            date: item.first_air_date || null,
            voteAverage: item.vote_average ?? null,
          }]
        : []
    )),
  ]
}

export async function saveSearchMapping(formData: FormData) {
  await requireAdmin()
  const query = String(formData.get('query') || '').trim()
  const mediaType = String(formData.get('mediaType') || '') as SearchMediaType
  const tmdbId = Number(formData.get('tmdbId'))
  const cacheKey = manualSearchCacheKey(query)

  if (
    !query
    || (mediaType !== 'movie' && mediaType !== 'tv')
    || !Number.isInteger(tmdbId)
    || tmdbId < 1
  ) {
    redirect(buildSearchErrorRedirectUrl('Enter a search text, media type, and valid TMDB ID.', formData))
  }
  if (cacheKey.length > MAX_TMDB_CACHE_KEY_LENGTH) {
    redirect(buildSearchErrorRedirectUrl('The search text is too long.', formData))
  }

  type TmdbDetails = {
    id?: number
    title?: string
    original_title?: string
    name?: string
    original_name?: string
    overview?: string
    poster_path?: string | null
    release_date?: string | null
    first_air_date?: string | null
    vote_average?: number | null
    vote_count?: number | null
    popularity?: number | null
  }

  let details: Awaited<ReturnType<typeof getCachedTmdb<TmdbDetails>>> | null = null
  try {
    details = await getCachedTmdb<TmdbDetails>(`/${mediaType}/${tmdbId}`, { language: 'en-US' })
  } catch {
    // The redirect below gives the admin a useful validation error.
  }
  const item = details?.payload
  const title = mediaType === 'movie' ? item?.title : item?.name
  if (details?.cache === 'bypass' || item?.id !== tmdbId || !title) {
    redirect(buildSearchErrorRedirectUrl('That TMDB ID could not be loaded for the selected media type.', formData))
  }

  const searchItem = mediaType === 'movie'
    ? {
        id: tmdbId,
        media_type: mediaType,
        title,
        original_title: item.original_title ?? title,
        overview: item.overview ?? '',
        poster_path: item.poster_path ?? null,
        release_date: item.release_date ?? null,
        vote_average: item.vote_average ?? null,
        vote_count: item.vote_count ?? null,
        popularity: item.popularity ?? null,
      }
    : {
        id: tmdbId,
        media_type: mediaType,
        name: title,
        original_name: item.original_name ?? title,
        overview: item.overview ?? '',
        poster_path: item.poster_path ?? null,
        first_air_date: item.first_air_date ?? null,
        vote_average: item.vote_average ?? null,
        vote_count: item.vote_count ?? null,
        popularity: item.popularity ?? null,
      }

  await upsertTmdbCache({
    cacheKey,
    path: SEARCH_MAPPING_PATH,
    query: manualSearchCacheQuery(query),
    status: 200,
    payload: { query, mediaType, tmdbId, item: searchItem },
  })
  await prisma.tmdbCache.deleteMany({
    where: { cacheKey: searchCaptureCacheKey(query), path: SEARCH_CAPTURE_PATH },
  })

  revalidatePath('/admin/search')
  redirect(buildSearchRedirectUrl('saved', formData))
}

export async function deleteSearchMapping(formData: FormData) {
  await requireAdmin()
  const query = String(formData.get('query') || '')
  const cacheKey = manualSearchCacheKey(query)

  if (cacheKey.length <= MAX_TMDB_CACHE_KEY_LENGTH) {
    await prisma.tmdbCache.deleteMany({ where: { cacheKey, path: SEARCH_MAPPING_PATH } })
  }
  revalidatePath('/admin/search')
  redirect(buildSearchRedirectUrl('deleted', formData))
}

// API Keys
export async function getApiKeys() {
  await requireAdmin()
  return prisma.apiKey.findMany({
    include: { owner: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createApiKey(label: string) {
  const session = await requireAdmin()
  const sessionUser = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined
  const userId = Number(sessionUser?.id) || (
    await prisma.user.findUnique({
      where: { username: sessionUser?.email || sessionUser?.name || '' },
      select: { id: true },
    })
  )?.id
  if (!userId) throw new Error('Unauthorized')
  const crypto = await import('crypto')
  const key = crypto.randomBytes(32).toString('hex')
  const keyHash = await hashApiKey(key)

  const apiKey = await prisma.apiKey.create({
    data: {
      keyHash,
      keyPrefix: key.slice(0, 12),
      label,
      active: true,
      ownerId: userId,
    },
  })

  return { ...apiKey, key }
}

export async function toggleApiKey(id: number) {
  await requireAdmin()
  const existing = await prisma.apiKey.findUnique({ where: { id } })
  await prisma.apiKey.update({
    where: { id },
    data: { active: !existing?.active },
  })
  revalidatePath('/admin/keys')
}

export async function deleteApiKey(id: number) {
  await requireAdmin()
  await prisma.apiKey.delete({ where: { id } })
  revalidatePath('/admin/keys')
}

// Sync Logs
export async function clearApiRequestLogs() {
  await requireAdmin()
  if (getDatabaseProvider() === 'postgresql') {
    await prisma.$executeRaw`TRUNCATE TABLE "ApiRequestLog" RESTART IDENTITY`
  } else {
    await prisma.$executeRaw`TRUNCATE TABLE ApiRequestLog`
  }
  clearUsageDashboardCache()
  revalidatePath('/admin/usage')
}

export async function dismissSearchCapture(formData: FormData) {
  await requireAdmin()
  const query = String(formData.get('query') || '').trim()
  const path = String(formData.get('path') || '')
  const cacheKey = searchCaptureCacheKey(query)

  if (
    query
    && normalizeSearchQuery(query)
    && isSearchCaptureSourcePath(path)
    && cacheKey.length <= MAX_TMDB_CACHE_KEY_LENGTH
  ) {
    await setSearchCaptureDismissed(path, query, true)
  }

  revalidatePath('/admin/search')
  redirect(buildSearchRedirectUrl('dismissed', formData))
}

export async function restoreSearchCapture(formData: FormData) {
  await requireAdmin()
  const query = String(formData.get('query') || '').trim()
  const path = String(formData.get('path') || '')
  const cacheKey = searchCaptureCacheKey(query)

  if (
    query
    && normalizeSearchQuery(query)
    && isSearchCaptureSourcePath(path)
    && cacheKey.length <= MAX_TMDB_CACHE_KEY_LENGTH
  ) {
    await setSearchCaptureDismissed(path, query, false)
  }

  revalidatePath('/admin/search')
  redirect(buildSearchRedirectUrl('restored', formData))
}

export async function blockIpAddress(value: string) {
  await requireAdmin()
  const address = validIpAddress(value)
  if (!address) throw new Error('Invalid IP address')
  await prisma.blockedIp.upsert({
    where: { address },
    create: { address },
    update: {},
  })
  revalidatePath('/admin/usage')
}

export async function unblockIpAddress(value: string) {
  await requireAdmin()
  const address = validIpAddress(value)
  if (!address) throw new Error('Invalid IP address')
  await prisma.blockedIp.deleteMany({ where: { address } })
  revalidatePath('/admin/usage')
}

export async function getSyncLogs(limit = 50) {
  await requireAdmin()
  return prisma.syncLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTmdbCacheStats() {
  await requireAdmin()
  const [counts, latest, recent] = await Promise.all([
    getCachedDataCounts(),
    prisma.tmdbCache.findFirst({
      where: { path: { notIn: PRESERVED_TMDB_CACHE_PATHS } },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    // ponytail: sample recent rows; use SQL grouping if the cache grows large.
    prisma.tmdbCache.findMany({
      where: { path: { notIn: PRESERVED_TMDB_CACHE_PATHS } },
      take: 1000,
      orderBy: { updatedAt: 'desc' },
      select: { path: true },
    }),
  ])

  const roots = new Map<string, number>()
  for (const item of recent) {
    const root = item.path.split('/').filter(Boolean)[0] || '/'
    roots.set(root, (roots.get(root) || 0) + 1)
  }

  return {
    ...counts,
    limit: TMDB_CACHE_MAX_ROWS,
    lastUpdatedAt: latest?.updatedAt ?? null,
    topRoots: [...roots.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, count]) => ({ path: `/${path}`, count })),
  }
}

export async function clearCachedTmdbData() {
  await requireAdmin()
  const result = await clearCachedData()

  revalidatePath('/admin/sync')
  revalidatePath('/admin/movies')
  revalidatePath('/admin/tv')

  return result
}

export async function updateGeoIpDatabase() {
  await requireAdmin()
  try {
    const { installDatabase } = await import('@/scripts/update-geoip.mjs')
    return await installDatabase()
  } catch (error) {
    console.warn('GeoIP update failed:', error)
    return { updated: false, error: error instanceof Error ? error.message : 'GeoIP update failed.' }
  }
}

const tmdbWarmups = {
  core: [
    ['/configuration', {}, false],
    ['/genre/movie/list', { language: 'en-US' }, false],
    ['/genre/tv/list', { language: 'en-US' }, false],
    ['/watch/providers/regions', { language: 'en-US' }, false],
    ['/watch/providers/movie', { language: 'en-US' }, false],
    ['/watch/providers/tv', { language: 'en-US' }, false],
  ],
  trending: [
    ['/trending/all/day', { language: 'en-US' }, true],
    ['/trending/movie/day', { language: 'en-US' }, true],
    ['/trending/tv/day', { language: 'en-US' }, true],
    ['/trending/person/day', { language: 'en-US' }, true],
  ],
  popular: [
    ['/movie/popular', { language: 'en-US' }, true],
    ['/tv/popular', { language: 'en-US' }, true],
    ['/movie/top_rated', { language: 'en-US' }, true],
    ['/tv/top_rated', { language: 'en-US' }, true],
  ],
} satisfies Record<string, Array<[string, Record<string, string>, boolean]>>

export type TmdbWarmupType = keyof typeof tmdbWarmups

export async function warmupTmdbCache(type: TmdbWarmupType, pages = 1) {
  await requireAdmin()
  const endpoints = tmdbWarmups[type]
  const pageCount = Math.min(Math.max(Math.trunc(pages) || 1, 1), 20)
  let success = 0
  let errors = 0

  for (const [endpoint, baseParams, paginated] of endpoints) {
    for (let page = 1; page <= (paginated ? pageCount : 1); page++) {
      const params = paginated ? { ...baseParams, page: String(page) } : baseParams
      const result = await getCachedTmdb(endpoint, params, true)

      if (result.cache === 'bypass') {
        errors++
        continue
      }
      success++
    }
  }

  await prisma.syncLog.create({
    data: {
      type: 'tmdb-cache',
      status: errors ? 'partial' : 'success',
      detail: `Warmed ${success} ${type} TMDB cache endpoints (${errors} errors, ${pageCount} page limit)`,
    },
  })

  revalidatePath('/admin/sync')
  return { success, errors }
}

export async function refreshMovieFromTmdb(tmdbId: number) {
  await requireAdmin()
  const data = await getMovieDetails(tmdbId)
  const movieData = extractMovieData(data)
  await prisma.movie.upsert({
    where: { tmdbId: data.id },
    create: movieData,
    update: movieData,
  })
  scheduleCachedDataLimitEnforcement()
  await getCachedTmdb(`/movie/${tmdbId}`, { append_to_response: 'credits,videos', language: 'en-US' }, true)
  revalidatePath(`/admin/movies/${tmdbId}`)
  revalidatePath('/admin/movies')
  return { success: 1, errors: 0 }
}

export async function refreshTvFromTmdb(tmdbId: number) {
  await requireAdmin()
  const data = await getTvDetails(tmdbId)
  const tvData = await extractTvDataFull(data, tmdbId)
  await prisma.tvShow.upsert({
    where: { tmdbId: data.id },
    create: tvData,
    update: tvData,
  })
  scheduleCachedDataLimitEnforcement()
  await getCachedTmdb(`/tv/${tmdbId}`, { append_to_response: 'credits,videos', language: 'en-US' }, true)
  revalidatePath(`/admin/tv/${tmdbId}`)
  revalidatePath('/admin/tv')
  return { success: 1, errors: 0 }
}

export async function refreshPersonFromTmdb(personId: number) {
  await requireAdmin()
  await getCachedTmdb(
    `/person/${personId}`,
    { append_to_response: 'combined_credits,images,external_ids', language: 'en-US' },
    true,
  )
  revalidatePath(`/admin/people/${personId}`)
  return { success: 1, errors: 0 }
}

// Sync Operations
export async function syncTrendingMovies() {
  await requireAdmin()
  const { results } = await getTrendingMovies('day')
  let success = 0
  let errors = 0

  for (const item of results) {
    try {
      const data = await getMovieDetails(item.id)
      const movieData = extractMovieData(data)
      await prisma.movie.upsert({
        where: { tmdbId: data.id },
        create: movieData,
        update: movieData,
      })
      success++
    } catch {
      errors++
    }
  }

  scheduleCachedDataLimitEnforcement()

  await prisma.syncLog.create({
    data: {
      type: 'bulk',
      status: 'success',
      detail: `Synced ${success} trending movies (${errors} errors)`,
    },
  })

  revalidatePath('/admin/sync')
  revalidatePath('/admin/movies')
  return { success, errors }
}

export async function syncTrendingTv() {
  await requireAdmin()
  const { results } = await getTrendingTv('day')
  let success = 0
  let errors = 0

  for (const item of results) {
    try {
      const data = await getTvDetails(item.id)
      const tvData = await extractTvDataFull(data, item.id)
      await prisma.tvShow.upsert({
        where: { tmdbId: data.id },
        create: tvData,
        update: tvData,
      })
      success++
    } catch {
      errors++
    }
  }

  scheduleCachedDataLimitEnforcement()

  await prisma.syncLog.create({
    data: {
      type: 'bulk',
      status: 'success',
      detail: `Synced ${success} trending TV shows (${errors} errors)`,
    },
  })

  revalidatePath('/admin/sync')
  revalidatePath('/admin/tv')
  return { success, errors }
}

export async function syncTopRatedMovies() {
  await requireAdmin()
  const { results } = await getTopRatedMovies(1)
  let success = 0
  let errors = 0

  for (const item of results) {
    try {
      const data = await getMovieDetails(item.id)
      const movieData = extractMovieData(data)
      await prisma.movie.upsert({
        where: { tmdbId: data.id },
        create: movieData,
        update: movieData,
      })
      success++
    } catch {
      errors++
    }
  }

  scheduleCachedDataLimitEnforcement()

  await prisma.syncLog.create({
    data: {
      type: 'bulk',
      status: 'success',
      detail: `Synced ${success} top rated movies (${errors} errors)`,
    },
  })

  revalidatePath('/admin/sync')
  revalidatePath('/admin/movies')
  return { success, errors }
}

export async function syncTopRatedTv() {
  await requireAdmin()
  const { results } = await getTopRatedTv(1)
  let success = 0
  let errors = 0

  for (const item of results) {
    try {
      const data = await getTvDetails(item.id)
      const tvData = await extractTvDataFull(data, item.id)
      await prisma.tvShow.upsert({
        where: { tmdbId: data.id },
        create: tvData,
        update: tvData,
      })
      success++
    } catch {
      errors++
    }
  }

  scheduleCachedDataLimitEnforcement()

  await prisma.syncLog.create({
    data: {
      type: 'bulk',
      status: 'success',
      detail: `Synced ${success} top rated TV shows (${errors} errors)`,
    },
  })

  revalidatePath('/admin/sync')
  revalidatePath('/admin/tv')
  return { success, errors }
}
