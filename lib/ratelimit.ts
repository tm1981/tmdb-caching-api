interface RateLimitEntry {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const DEFAULT_MAX_REQUESTS = 60
const DEFAULT_WINDOW_MS = 60 * 1000

function cleanup(entry: RateLimitEntry, windowMs: number) {
  const now = Date.now()
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)
}

export function checkRateLimit(
  key: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
): { allowed: boolean; remaining: number; resetAt: number } {
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
    return { allowed: false, remaining: 0, resetAt }
  }

  entry.timestamps.push(now)
  const remaining = maxRequests - entry.timestamps.length
  const resetAt = entry.timestamps[0] + windowMs

  return { allowed: true, remaining, resetAt }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    cleanup(entry, DEFAULT_WINDOW_MS)
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000)
