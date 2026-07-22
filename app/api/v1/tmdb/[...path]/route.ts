export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tmdbRawRequest } from '@/lib/tmdb'
import { withApiUsage } from '@/lib/api-usage'
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
  const cleanPath = path.map(segment => decodeURIComponent(segment)).filter(Boolean)

  if (!isAllowedPath(cleanPath)) {
    return NextResponse.json(
      { error: 'Only public TMDB content GET endpoints are mirrored.' },
      { status: 404 },
    )
  }

  const endpoint = `/${cleanPath.map(encodeURIComponent).join('/')}`
  const query = canonicalQuery(req.nextUrl.searchParams)
  const cacheKey = `${endpoint}?${query}`
  const refresh = req.nextUrl.searchParams.get('refresh') === 'true'

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

  if (!refresh) {
    const cached = await prisma.tmdbCache.findUnique({ where: { cacheKey } })
    if (cached) {
      const mapping = parseManualSearchMapping((await mappingPromise)?.payload)
      return NextResponse.json(applyManualSearchMapping(cached.payload, mapping, expectedMediaType), {
        status: cached.status,
        headers: tmdbSearchResponseHeaders('hit', mapping, expectedMediaType),
      })
    }
  }

  const upstreamParams = new URLSearchParams(query)
  const result = await tmdbRawRequest(endpoint, upstreamParams)

  if (result.ok) {
    await prisma.tmdbCache.upsert({
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
    })
  }

  const mapping = parseManualSearchMapping((await mappingPromise)?.payload)
  return NextResponse.json(applyManualSearchMapping(result.payload, mapping, expectedMediaType), {
    status: result.status,
    headers: tmdbSearchResponseHeaders(result.ok ? 'miss' : 'bypass', mapping, expectedMediaType),
  })
}

export const GET = withApiUsage(getTmdb)
