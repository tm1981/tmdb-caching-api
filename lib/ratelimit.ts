import { isIP } from 'node:net'

interface RateLimitEntry {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const DEFAULT_MAX_REQUESTS = 60
const DEFAULT_WINDOW_MS = 60 * 1000

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
  bypassed: boolean
}

export function rateLimitBypassed(headers: Headers) {
  const address = (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')?.trim()
    || 'unknown'
  ).slice(0, 45)
  if (!isIP(address)) return false
  return (process.env.RATE_LIMIT_BYPASS_IPS || '')
    .split(',')
    .some(entry => entry.trim() === address)
}

function cleanup(entry: RateLimitEntry, windowMs: number) {
  const now = Date.now()
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)
}

export function checkRateLimit(
  key: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now()
  let entry = rateLimitStore.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(key, entry)
  }

  cleanup(entry, windowMs)

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const resetAt = oldestInWindow + windowMs
    return { allowed: false, remaining: 0, resetAt, limit: maxRequests, bypassed: false }
  }

  entry.timestamps.push(now)
  const remaining = maxRequests - entry.timestamps.length
  const resetAt = entry.timestamps[0] + windowMs

  return { allowed: true, remaining, resetAt, limit: maxRequests, bypassed: false }
}

export function checkRequestRateLimit(
  headers: Headers,
  key: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
): RateLimitResult {
  if (rateLimitBypassed(headers)) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: 0,
      limit: maxRequests,
      bypassed: true,
    }
  }
  return checkRateLimit(key, maxRequests, windowMs)
}

export function rateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  return Response.json(
    {
      error: 'Rate limit exceeded. Try again later.',
      code: 'RATE_LIMITED',
      source: 'tmdb-service',
      retry_after: retryAfter,
    },
    {
      status: 429,
      headers: {
        'retry-after': String(retryAfter),
        'x-ratelimit-limit': String(result.limit),
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.ceil(result.resetAt / 1000)),
        'x-ratelimit-source': 'tmdb-service',
      },
    },
  )
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    cleanup(entry, DEFAULT_WINDOW_MS)
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000).unref()
