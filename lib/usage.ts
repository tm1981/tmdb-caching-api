export const USAGE_RANGES = ['24h', '7d', '30d'] as const
export type UsageRange = (typeof USAGE_RANGES)[number]
export type UsageStatusFilter = 'all' | '2xx' | '4xx' | '5xx' | '429'

const RANGE_HOURS: Record<UsageRange, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

const SENSITIVE_QUERY_KEYS = new Set([
  'api_key',
  'key',
  'token',
  'access_token',
])

const COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'cloudfront-viewer-country',
  'x-country-code',
]

const displayNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null

export function parseUsageRange(value: string | undefined): UsageRange {
  return USAGE_RANGES.includes(value as UsageRange) ? value as UsageRange : '24h'
}

export function usageRangeHours(range: UsageRange) {
  return RANGE_HOURS[range]
}

export function utcHour(date: Date) {
  const bucket = new Date(date)
  bucket.setUTCMinutes(0, 0, 0)
  return bucket
}

export function sanitizeQuery(input: URLSearchParams | string) {
  const params = new URLSearchParams(input)
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, '[redacted]')
    }
  }
  return params.toString().slice(0, 4096)
}

function trustedProxyCount() {
  const parsed = Number(process.env.TRUSTED_PROXY_COUNT)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}

// Clients can prepend anything to X-Forwarded-For, so only the entry appended by the
// outermost trusted proxy (counting from the right) identifies the real client.
export function clientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')
    ?.split(',')
    .map(part => part.trim())
    .filter(Boolean) || []
  const hops = trustedProxyCount()

  return (
    forwarded[Math.max(0, forwarded.length - hops)]
    || headers.get('x-real-ip')?.trim()
    || 'unknown'
  ).slice(0, 45)
}

export function clientCountryCode(headers: Headers) {
  for (const header of COUNTRY_HEADERS) {
    const value = headers.get(header)?.trim().toUpperCase()
    if (value && /^[A-Z]{2}$/.test(value) && !['XX', 'T1'].includes(value)) {
      return value
    }
  }
  return null
}

export function countryName(code: string | null) {
  if (!code || !/^[A-Z]{2}$/.test(code) || ['XX', 'T1'].includes(code)) return 'Unknown'
  try {
    return displayNames?.of(code) || code
  } catch {
    return code
  }
}

export function percentage(part: number, total: number) {
  return total ? (part / total) * 100 : 0
}

export function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function percentile95(values: number[]) {
  if (!values.length) return 0
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]
}

export function normalizedCacheStatus(value: string | null) {
  return value === 'hit' || value === 'miss' || value === 'bypass' ? value : null
}

export function normalizedRateLimitSource(value: string | null) {
  return value === 'tmdb' ? value : null
}

export function polylinePoints(values: number[], width: number, height: number) {
  if (!values.length) return ''
  const maximum = Math.max(...values, 1)
  const step = values.length === 1 ? 0 : width / (values.length - 1)
  return values
    .map((value, index) => `${(index * step).toFixed(2)},${(height - (value / maximum) * height).toFixed(2)}`)
    .join(' ')
}
