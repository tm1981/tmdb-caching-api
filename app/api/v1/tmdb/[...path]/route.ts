export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tmdbRawRequest } from '@/lib/tmdb'
import { tmdbEndpoint } from '@/lib/tmdb-path'
import { withApiUsage } from '@/lib/api-usage'
import { withLocalMediaConfiguration } from '@/lib/media-cache'
import { privateCacheControl, tmdbCacheTtlMs } from '@/lib/cache-ttl'
import {
  isStaleTmdbCache,
  queueSearchCapture,
  refreshTmdbCacheInBackground,
  upsertTmdbCache,
} from '@/lib/tmdb-cache'
import {
  applyManualSearchMapping,
  manualSearchCacheKey,
  MAX_TMDB_CACHE_KEY_LENGTH,
  parseManualSearchMapping,
  tmdbSearchResponseHeaders,
  type SearchMediaType,
} from '@/lib/search-mappings'

const CONTENT_ROOTS = new Set([
  'movie',
  'tv',
  'person',
  'collection',
  'company',
  'network',
  'keyword',
  'search',
  'discover',
  'trending',
  'genre',
  'certification',
  'watch',
  'configuration',
  'find',
])

const BLOCKED_ROOTS = new Set([
  'account',
  'authentication',
  'guest_session',
  'list',
])

function isAllowedPath(path: string[]) {
  const [root, next] = path

  if (!root || BLOCKED_ROOTS.has(root) || !CONTENT_ROOTS.has(root)) {
    return false
  }

  if (root === 'watch') return next === 'providers'
  if (root === 'search') {
    return ['movie', 'tv', 'person', 'multi', 'collection', 'company', 'keyword'].includes(next || '')
  }
  if (root === 'discover') return ['movie', 'tv'].includes(next || '')
  if (root === 'trending') return ['all', 'movie', 'tv', 'person'].includes(next || '')

  return true
}

function canonicalQuery(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams)
  // `refresh` is no longer honored for API clients (stale rows refetch on their own), but it stays
  // out of the cache key and the upstream request so older clients keep hitting the same rows.
  params.delete('refresh')
  return [...params.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

async function getTmdb(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const validated = tmdbEndpoint(path)

  if (!validated || !isAllowedPath(validated.segments)) {
    return NextResponse.json(
      { error: 'Only public TMDB content GET endpoints are mirrored.' },
      { status: 404 },
    )
  }

  const { endpoint } = validated
  const query = canonicalQuery(req.nextUrl.searchParams)
  const cacheKey = `${endpoint}?${query}`

  if (cacheKey.length > MAX_TMDB_CACHE_KEY_LENGTH) {
    return NextResponse.json(
      { error: 'TMDB mirror query is too long.' },
      { status: 414 },
    )
  }

  const mappedSearch = ['/search/multi', '/search/movie', '/search/tv'].includes(endpoint)
  const searchText = mappedSearch ? req.nextUrl.searchParams.get('query') || '' : ''
  const expectedMediaType: SearchMediaType | undefined = endpoint === '/search/movie'
    ? 'movie'
    : endpoint === '/search/tv'
      ? 'tv'
      : undefined
  const mappingPromise = searchText
    ? prisma.tmdbCache.findUnique({
        where: { cacheKey: manualSearchCacheKey(searchText) },
        select: { payload: true },
      })
    : Promise.resolve(null)

  const responsePayload = (payload: unknown) => endpoint === '/configuration'
    ? withLocalMediaConfiguration(payload, req.nextUrl.origin)
    : payload

  const ttlMs = tmdbCacheTtlMs(endpoint)
  const cached = await prisma.tmdbCache.findUnique({ where: { cacheKey } })
  if (cached) {
    const stale = isStaleTmdbCache(endpoint, cached.updatedAt)
    if (stale) refreshTmdbCacheInBackground(endpoint, query)
    const mapping = parseManualSearchMapping((await mappingPromise)?.payload)
    if (mappedSearch) queueSearchCapture(endpoint, searchText, cached.payload, 'hit', Boolean(mapping))
    return NextResponse.json(responsePayload(applyManualSearchMapping(cached.payload, mapping, expectedMediaType)), {
      status: cached.status,
      headers: {
        ...tmdbSearchResponseHeaders('hit', mapping, expectedMediaType),
        'cache-control': privateCacheControl(ttlMs, cached.updatedAt),
        ...(stale && { 'x-tmdb-cache-stale': 'true' }),
      },
    })
  }

  const upstreamParams = new URLSearchParams(query)
  const result = await tmdbRawRequest(endpoint, upstreamParams)

  if (result.ok) {
    await upsertTmdbCache({
      cacheKey,
      path: endpoint,
      query,
      status: result.status,
      payload: result.payload,
    })
  }

  const mapping = parseManualSearchMapping((await mappingPromise)?.payload)
  if (result.ok && mappedSearch) queueSearchCapture(endpoint, searchText, result.payload, 'miss', Boolean(mapping))
  return NextResponse.json(responsePayload(applyManualSearchMapping(result.payload, mapping, expectedMediaType)), {
    status: result.status,
    headers: {
      ...tmdbSearchResponseHeaders(result.ok ? 'miss' : 'bypass', mapping, expectedMediaType),
      'cache-control': result.ok ? privateCacheControl(ttlMs) : 'no-store',
      ...(result.status === 429 && {
        'x-ratelimit-source': 'tmdb',
        'retry-after': result.retryAfter || '60',
      }),
    },
  })
}

export const GET = withApiUsage(getTmdb)
