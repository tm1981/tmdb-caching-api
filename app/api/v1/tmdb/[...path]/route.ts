export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { tmdbRawRequest } from '@/lib/tmdb'
import { withApiUsage } from '@/lib/api-usage'

const MAX_CACHE_KEY_LENGTH = 512

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

  if (cacheKey.length > MAX_CACHE_KEY_LENGTH) {
    return NextResponse.json(
      { error: 'TMDB mirror query is too long.' },
      { status: 414 },
    )
  }

  if (!refresh) {
    const cached = await prisma.tmdbCache.findUnique({ where: { cacheKey } })
    if (cached) {
      return NextResponse.json(cached.payload, {
        status: cached.status,
        headers: { 'x-tmdb-cache': 'hit' },
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

  return NextResponse.json(result.payload, {
    status: result.status,
    headers: { 'x-tmdb-cache': result.ok ? 'miss' : 'bypass' },
  })
}

export const GET = withApiUsage(getTmdb)
