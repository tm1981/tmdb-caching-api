'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { hashApiKey } from '@/lib/api-keys'
import prisma from '@/lib/prisma'
import { paginationParams } from '@/lib/pagination'
import { getCachedTmdb } from '@/lib/tmdb-cache'
import {
  isUnresolvedSearchPayload,
  manualSearchCacheKey,
  manualSearchCacheQuery,
  MAX_TMDB_CACHE_KEY_LENGTH,
  normalizeSearchQuery,
  parseManualSearchMapping,
  SEARCH_MAPPING_PATH,
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
export async function getSearchFixes() {
  await requireAdmin()
  const [searches, mappingRows] = await Promise.all([
    prisma.tmdbCache.findMany({
      where: { path: { in: ['/search/multi', '/search/movie', '/search/tv'] } },
      // ponytail: scan recent cache rows; paginate if unresolved search volume grows past 500.
      take: 500,
      orderBy: { updatedAt: 'desc' },
      select: { path: true, query: true, payload: true, updatedAt: true },
    }),
    prisma.tmdbCache.findMany({
      where: { path: SEARCH_MAPPING_PATH },
      orderBy: { updatedAt: 'desc' },
      select: { payload: true, updatedAt: true },
    }),
  ])

  const mappings = mappingRows.flatMap((row) => {
    const mapping = parseManualSearchMapping(row.payload)
    return mapping ? [{ ...mapping, updatedAt: row.updatedAt }] : []
  })
  const mappedQueries = new Set(mappings.map((mapping) => normalizeSearchQuery(mapping.query)))
  const unresolved = new Map<string, {
    query: string
    path: string
    capturedAt: Date
  }>()

  for (const search of searches) {
    const query = new URLSearchParams(search.query).get('query')?.trim()
    const normalized = query ? normalizeSearchQuery(query) : ''
    if (
      !query
      || !normalized
      || mappedQueries.has(normalized)
      || unresolved.has(normalized)
      || !isUnresolvedSearchPayload(search.path, search.payload)
    ) {
      continue
    }
    unresolved.set(normalized, {
      query,
      path: search.path,
      capturedAt: search.updatedAt,
    })
  }

  return { unresolved: [...unresolved.values()], mappings }
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
    redirect('/admin/search?error=Enter+a+search+text%2C+media+type%2C+and+valid+TMDB+ID.')
  }
  if (cacheKey.length > MAX_TMDB_CACHE_KEY_LENGTH) {
    redirect('/admin/search?error=The+search+text+is+too+long.')
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
    redirect('/admin/search?error=That+TMDB+ID+could+not+be+loaded+for+the+selected+media+type.')
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

  await prisma.tmdbCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      path: SEARCH_MAPPING_PATH,
      query: manualSearchCacheQuery(query),
      status: 200,
      payload: { query, mediaType, tmdbId, item: searchItem },
    },
    update: {
      query: manualSearchCacheQuery(query),
      status: 200,
      payload: { query, mediaType, tmdbId, item: searchItem },
    },
  })

  revalidatePath('/admin/search')
  redirect('/admin/search?saved=1')
}

export async function deleteSearchMapping(formData: FormData) {
  await requireAdmin()
  const query = String(formData.get('query') || '')
  const cacheKey = manualSearchCacheKey(query)

  if (cacheKey.length <= MAX_TMDB_CACHE_KEY_LENGTH) {
    await prisma.tmdbCache.deleteMany({ where: { cacheKey, path: SEARCH_MAPPING_PATH } })
  }
  revalidatePath('/admin/search')
  redirect('/admin/search?deleted=1')
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
export async function getSyncLogs(limit = 50) {
  await requireAdmin()
  return prisma.syncLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTmdbCacheStats() {
  await requireAdmin()
  const [total, latest, recent] = await Promise.all([
    prisma.tmdbCache.count(),
    prisma.tmdbCache.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    // ponytail: sample recent rows; use SQL grouping if the cache grows large.
    prisma.tmdbCache.findMany({
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
    total,
    lastUpdatedAt: latest?.updatedAt ?? null,
    topRoots: [...roots.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, count]) => ({ path: `/${path}`, count })),
  }
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
