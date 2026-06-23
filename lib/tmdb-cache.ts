import prisma from '@/lib/prisma'
import { tmdbRawRequest } from '@/lib/tmdb'

export function canonicalParams(params: Record<string, string | number | undefined>) {
  return Object.entries(params)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
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
    if (cached) return { payload: cached.payload as T, cache: 'hit' as const, updatedAt: cached.updatedAt }
  }

  const result = await tmdbRawRequest(endpoint, new URLSearchParams(query))
  if (!result.ok) return { payload: result.payload as T, cache: 'bypass' as const, updatedAt: null }

  const cached = await prisma.tmdbCache.upsert({
    where: { cacheKey },
    create: {
      cacheKey,
      path: endpoint,
      query,
      status: result.status,
      payload: result.payload,
    },
    update: {
      status: result.status,
      payload: result.payload,
    },
    select: { updatedAt: true },
  })

  return { payload: result.payload as T, cache: 'miss' as const, updatedAt: cached.updatedAt }
}
