import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import {
  clientCountryCode,
  clientIp,
  normalizedCacheStatus,
  sanitizeQuery,
  utcHour,
} from '@/lib/usage'

const KEY_ID_HEADER = 'x-tmdb-usage-key-id'
const KEY_LABEL_HEADER = 'x-tmdb-usage-key-label'
const KEY_PREFIX_HEADER = 'x-tmdb-usage-key-prefix'
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

type ApiKeySnapshot = {
  id: number
  label: string
  keyPrefix: string
}

type UsageWrite = {
  apiKeyId: number | null
  apiKeyLabel: string | null
  apiKeyPrefix: string
  method: string
  endpoint: string
  query: string
  status: number
  durationMs: number
  ipAddress: string
  countryCode: string | null
  cacheStatus: string | null
  hourBucket: Date
  createdAt: Date
}

let lastPruneDay = ''

function decodedHeader(value: string | null) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function requestKey(request: NextRequest): ApiKeySnapshot | null {
  const id = Number(request.headers.get(KEY_ID_HEADER))
  if (!Number.isInteger(id) || id < 1) return null
  return {
    id,
    label: decodedHeader(request.headers.get(KEY_LABEL_HEADER))?.slice(0, 191) || 'Unknown key',
    keyPrefix: (request.headers.get(KEY_PREFIX_HEADER) || '').slice(0, 32),
  }
}

function usageWrite(
  request: NextRequest,
  status: number,
  durationMs: number,
  cacheStatus: string | null,
  key = requestKey(request),
): UsageWrite {
  const createdAt = new Date()
  return {
    apiKeyId: key?.id ?? null,
    apiKeyLabel: key?.label ?? null,
    apiKeyPrefix: key?.keyPrefix ?? '',
    method: request.method.slice(0, 16),
    endpoint: request.nextUrl.pathname.slice(0, 512),
    query: sanitizeQuery(request.nextUrl.searchParams),
    status,
    durationMs: Math.max(0, Math.round(durationMs)),
    ipAddress: clientIp(request.headers),
    countryCode: clientCountryCode(request.headers),
    cacheStatus: normalizedCacheStatus(cacheStatus),
    hourBucket: utcHour(createdAt),
    createdAt,
  }
}

async function persistUsage(data: UsageWrite) {
  await prisma.apiRequestLog.create({ data })

  const day = data.createdAt.toISOString().slice(0, 10)
  if (day === lastPruneDay) return
  // ponytail: per-process daily cleanup is enough for this app; use a scheduled job if log volume grows.
  await prisma.apiRequestLog.deleteMany({
    where: { createdAt: { lt: new Date(data.createdAt.getTime() - RETENTION_MS) } },
  })
  lastPruneDay = day
}

function queueUsage(data: UsageWrite) {
  after(() => persistUsage(data).catch(error => {
    console.warn('API usage log failed:', error)
  }))
}

export function usageRequestHeaders(request: NextRequest, key: ApiKeySnapshot) {
  const headers = new Headers(request.headers)
  headers.set(KEY_ID_HEADER, String(key.id))
  headers.set(KEY_LABEL_HEADER, encodeURIComponent(key.label.slice(0, 191)))
  headers.set(KEY_PREFIX_HEADER, key.keyPrefix.slice(0, 32))
  return headers
}

export function queueProxyUsage(
  request: NextRequest,
  status: number,
  startedAt: number,
  key: ApiKeySnapshot | null = null,
) {
  queueUsage(usageWrite(request, status, performance.now() - startedAt, null, key))
}

export function withApiUsage<Context>(
  handler: (request: NextRequest, context: Context) => Promise<Response>,
) {
  return async (request: NextRequest, context: Context) => {
    const startedAt = performance.now()
    let status = 500
    let durationMs = 0
    let cacheStatus: string | null = null

    after(() => persistUsage(usageWrite(request, status, durationMs, cacheStatus)).catch(error => {
      console.warn('API usage log failed:', error)
    }))

    try {
      const response = await handler(request, context)
      status = response.status
      cacheStatus = response.headers.get('x-tmdb-cache')
      return response
    } finally {
      durationMs = performance.now() - startedAt
    }
  }
}
