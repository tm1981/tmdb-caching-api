import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { tmdbRawRequest } from '@/lib/tmdb'
import { retryPrismaUniqueConflict } from '@/lib/prisma-conflict'
import { scheduleCachedDataLimitEnforcement } from '@/lib/cache-limit'
import {
  isSearchCaptureSourcePath,
  isUnresolvedSearchPayload,
  manualSearchCacheQuery,
  normalizeSearchQuery,
  parseSearchCapture,
  searchCaptureCacheKey,
  SEARCH_CAPTURE_PATH,
} from '@/lib/search-mappings'

type TmdbCacheWrite = {
  cacheKey: string
  path: string
  query: string
  status: number
  payload: Prisma.InputJsonValue
}

export async function upsertTmdbCache(data: TmdbCacheWrite) {
  const update = {
    path: data.path,
    query: data.query,
    status: data.status,
    payload: data.payload,
  }

  const cached = await retryPrismaUniqueConflict(
    () => prisma.tmdbCache.upsert({
      where: { cacheKey: data.cacheKey },
      create: data,
      update,
      select: { updatedAt: true },
    }),
    () => prisma.tmdbCache.update({
      where: { cacheKey: data.cacheKey },
      data: update,
      select: { updatedAt: true },
    }),
  )
  scheduleCachedDataLimitEnforcement()
  return cached
}

export function canonicalParams(params: Record<string, string | number | undefined>) {
  return Object.entries(params)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export async function syncSearchCapture(endpoint: string, query: string, payload: unknown) {
  const cleanQuery = query.trim()
  if (!cleanQuery || !isSearchCaptureSourcePath(endpoint)) return

  const cacheKey = searchCaptureCacheKey(cleanQuery)
  if (!isUnresolvedSearchPayload(endpoint, payload)) {
    await prisma.tmdbCache.deleteMany({ where: { cacheKey, path: SEARCH_CAPTURE_PATH } })
    return
  }

  const existing = await prisma.tmdbCache.findUnique({
    where: { cacheKey },
    select: { payload: true },
  })
  const capture = parseSearchCapture(existing?.payload)
  const now = new Date().toISOString()

  // ponytail: JSON counters may lose an increment under concurrent workers; add a dedicated model if exact counts matter.
  await upsertTmdbCache({
    cacheKey,
    path: SEARCH_CAPTURE_PATH,
    query: manualSearchCacheQuery(cleanQuery),
    status: 200,
    payload: {
      query: capture?.query || cleanQuery,
      path: endpoint,
      dismissed: capture?.dismissed || false,
      occurrences: (capture?.occurrences || 0) + 1,
      firstSeen: capture?.firstSeen || now,
      lastSeen: now,
    },
  })
}

export async function setSearchCaptureDismissed(endpoint: string, query: string, dismissed: boolean) {
  const cleanQuery = query.trim()
  if (!cleanQuery || !isSearchCaptureSourcePath(endpoint)) return

  const cacheKey = searchCaptureCacheKey(cleanQuery)
  const existing = await prisma.tmdbCache.findUnique({
    where: { cacheKey },
    select: { payload: true },
  })
  const capture = parseSearchCapture(existing?.payload)
  const now = new Date().toISOString()

  await upsertTmdbCache({
    cacheKey,
    path: SEARCH_CAPTURE_PATH,
    query: manualSearchCacheQuery(cleanQuery),
    status: 200,
    payload: {
      query: capture?.query || cleanQuery,
      path: capture?.path || endpoint,
      dismissed,
      occurrences: capture?.occurrences || 1,
      firstSeen: capture?.firstSeen || now,
      lastSeen: capture?.lastSeen || now,
    },
  })
}

export async function getTmdbCacheInfo(endpoint: string, params: Record<string, string | number | undefined> = {}) {
  const query = canonicalParams(params)
  return prisma.tmdbCache.findUnique({
    where: { cacheKey: `${endpoint}?${query}` },
    select: { updatedAt: true, status: true },
  })
}

export async function getCachedTmdb<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  refresh = false,
) {
  const query = canonicalParams(params)
  const cacheKey = `${endpoint}?${query}`

  if (!refresh) {
    const cached = await prisma.tmdbCache.findUnique({ where: { cacheKey } })
    if (cached) return {
      payload: cached.payload as T,
      cache: 'hit' as const,
      updatedAt: cached.updatedAt,
      status: cached.status,
      retryAfter: null,
    }
  }

  const result = await tmdbRawRequest(endpoint, new URLSearchParams(query))
  if (!result.ok) return {
    payload: result.payload as T,
    cache: 'bypass' as const,
    updatedAt: null,
    status: result.status,
    retryAfter: result.retryAfter,
  }

  const cached = await upsertTmdbCache({
    cacheKey,
    path: endpoint,
    query,
    status: result.status,
    payload: result.payload,
  })

  return {
    payload: result.payload as T,
    cache: 'miss' as const,
    updatedAt: cached.updatedAt,
    status: result.status,
    retryAfter: result.retryAfter,
  }
}
