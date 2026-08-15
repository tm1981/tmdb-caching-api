import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createStaleWhileRevalidateCache } from '@/lib/stale-cache'
import {
  countryName,
  parseUsageRange,
  percentage,
  percentChange,
  percentile95,
  usageRangeHours,
  utcHour,
  type UsageRange,
  type UsageStatusFilter,
} from '@/lib/usage'

const HOUR_MS = 60 * 60 * 1000
const PAGE_SIZE = 25
const LATENCY_SAMPLE_SIZE = 5000
const AGGREGATE_FRESH_MS = 60 * 1000

type DashboardInput = {
  range?: string
  search?: string
  status?: string
  country?: string
  page?: number
}

type CountRow = { _count: { _all: number } }
type StatusRow = CountRow & { status: number }
type RateLimitRow = StatusRow & { rateLimitSource: string | null }
type CacheRow = CountRow & { cacheStatus: string | null }
type HourlyStatusRow = RateLimitRow & { hourBucket: Date }
type HourlyCacheRow = CacheRow & { hourBucket: Date }
type HourlyClientRow = { hourBucket: Date; apiKeyId: number | null; ipAddress: string }
type TopIpRow = CountRow & { ipAddress: string; _avg: { durationMs: number | null } }
type IpBreakdownRow = RateLimitRow & { ipAddress: string; cacheStatus: string | null }

type UsageAggregateData = Awaited<ReturnType<typeof loadUsageAggregates>>
type UsageAggregateCache = ReturnType<
  typeof createStaleWhileRevalidateCache<UsageRange, UsageAggregateData>
>
const globalForUsageDashboard = globalThis as unknown as {
  usageAggregateCache: UsageAggregateCache | undefined
}
const usageAggregateCache = globalForUsageDashboard.usageAggregateCache
  ?? createStaleWhileRevalidateCache<UsageRange, UsageAggregateData>({
    freshMs: AGGREGATE_FRESH_MS,
    onRefreshError: error => console.warn('Usage dashboard aggregate refresh failed:', error),
  })
globalForUsageDashboard.usageAggregateCache = usageAggregateCache

function statusFilter(value: string | undefined): UsageStatusFilter {
  return ['2xx', '4xx', '5xx', '429'].includes(value || '')
    ? value as UsageStatusFilter
    : 'all'
}

function statusWhere(status: UsageStatusFilter): Prisma.ApiRequestLogWhereInput | null {
  if (status === '429') return { status: 429 }
  if (status === '2xx') return { status: { gte: 200, lt: 300 } }
  if (status === '4xx') return { status: { gte: 400, lt: 500 } }
  if (status === '5xx') return { status: { gte: 500, lt: 600 } }
  return null
}

function sumCounts<T extends CountRow>(rows: T[]) {
  return rows.reduce((total, row) => total + row._count._all, 0)
}

function statusCount(rows: StatusRow[], predicate: (status: number) => boolean) {
  return rows.reduce(
    (total, row) => total + (predicate(row.status) ? row._count._all : 0),
    0,
  )
}

function rateLimitCount(rows: RateLimitRow[], source?: 'tmdb' | 'tmdb-service') {
  return rows.reduce((total, row) => {
    const matches = source
      ? row.rateLimitSource === source
      : row.status === 429 || row.rateLimitSource !== null
    return total + (matches ? row._count._all : 0)
  }, 0)
}

function cacheCount(rows: CacheRow[], value: string) {
  return rows.find(row => row.cacheStatus === value)?._count._all || 0
}

function seriesStepHours(range: UsageRange) {
  if (range === '7d') return 6
  if (range === '30d') return 24
  return 1
}

function seriesBuckets(range: UsageRange, start: Date, end: Date) {
  const stepMs = seriesStepHours(range) * HOUR_MS
  const first = utcHour(start)
  const count = Math.floor((utcHour(end).getTime() - first.getTime()) / stepMs) + 1
  return {
    first,
    stepMs,
    dates: Array.from({ length: count }, (_, index) => new Date(first.getTime() + index * stepMs)),
  }
}

function bucketIndex(hour: Date, first: Date, stepMs: number, count: number) {
  const index = Math.floor((hour.getTime() - first.getTime()) / stepMs)
  return index >= 0 && index < count ? index : -1
}

function buildSeries(
  range: UsageRange,
  start: Date,
  end: Date,
  statuses: HourlyStatusRow[],
  caches: HourlyCacheRow[],
  clients: HourlyClientRow[],
) {
  const { first, stepMs, dates } = seriesBuckets(range, start, end)
  const requests = dates.map(() => 0)
  const successes = dates.map(() => 0)
  const hits = dates.map(() => 0)
  const misses = dates.map(() => 0)
  const clientSets = dates.map(() => new Set<string>())

  for (const row of statuses) {
    const index = bucketIndex(row.hourBucket, first, stepMs, dates.length)
    if (index < 0) continue
    requests[index] += row._count._all
    if (row.status < 400) successes[index] += row._count._all
  }

  for (const row of caches) {
    const index = bucketIndex(row.hourBucket, first, stepMs, dates.length)
    if (index < 0) continue
    if (row.cacheStatus === 'hit') hits[index] += row._count._all
    if (row.cacheStatus === 'miss') misses[index] += row._count._all
  }

  // ponytail: group distinct clients in memory; pre-aggregate only if 30-day traffic makes this measurable.
  for (const row of clients) {
    const index = bucketIndex(row.hourBucket, first, stepMs, dates.length)
    if (index >= 0) clientSets[index].add(`${row.apiKeyId}:${row.ipAddress}`)
  }

  return {
    dates,
    requests,
    activeClients: clientSets.map(set => set.size),
    successRate: requests.map((total, index) => percentage(successes[index], total)),
    cacheHitRate: hits.map((count, index) => percentage(count, count + misses[index])),
  }
}

function seriesLabel(date: Date, range: UsageRange) {
  if (range === '24h') {
    return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (range === '7d') return date.toLocaleDateString('en', { weekday: 'short' })
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

async function loadUsageAggregates(range: UsageRange) {
  const now = new Date()
  const durationMs = usageRangeHours(range) * HOUR_MS
  const start = new Date(now.getTime() - durationMs)
  const previousStart = new Date(start.getTime() - durationMs)
  const currentWhere = { createdAt: { gte: start, lte: now } }
  const previousWhere = { createdAt: { gte: previousStart, lt: start } }
  const activeStart = new Date(now.getTime() - 5 * 60 * 1000)
  const previousActiveStart = new Date(now.getTime() - 10 * 60 * 1000)

  // Keep aggregate refreshes below the 10-connection MySQL pool limit so a
  // background dashboard refresh cannot crowd out normal API traffic.
  const [
    previousStatuses,
    previousCaches,
    hourlyStatuses,
    hourlyCaches,
    currentLatencySample,
    previousLatencySample,
  ] = await Promise.all([
    prisma.apiRequestLog.groupBy({ by: ['status', 'rateLimitSource'], where: previousWhere, _count: { _all: true } }),
    prisma.apiRequestLog.groupBy({
      by: ['cacheStatus'],
      where: { ...previousWhere, cacheStatus: { in: ['hit', 'miss'] } },
      _count: { _all: true },
    }),
    prisma.apiRequestLog.groupBy({
      by: ['hourBucket', 'status', 'rateLimitSource'],
      where: currentWhere,
      _count: { _all: true },
    }),
    prisma.apiRequestLog.groupBy({
      by: ['hourBucket', 'cacheStatus'],
      where: { ...currentWhere, cacheStatus: { in: ['hit', 'miss'] } },
      _count: { _all: true },
    }),
    prisma.apiRequestLog.findMany({
      where: currentWhere,
      orderBy: { createdAt: 'desc' },
      take: LATENCY_SAMPLE_SIZE,
      select: { durationMs: true },
    }),
    prisma.apiRequestLog.findMany({
      where: previousWhere,
      orderBy: { createdAt: 'desc' },
      take: LATENCY_SAMPLE_SIZE,
      select: { durationMs: true },
    }),
  ])

  const [
    activeClients,
    previousActiveClients,
    hourlyClients,
    endpointRows,
    countryRows,
    keyRows,
    topIpRows,
  ] = await Promise.all([
    prisma.apiRequestLog.groupBy({
      by: ['apiKeyId', 'ipAddress'],
      where: { apiKeyId: { not: null }, createdAt: { gte: activeStart, lte: now } },
    }),
    prisma.apiRequestLog.groupBy({
      by: ['apiKeyId', 'ipAddress'],
      where: { apiKeyId: { not: null }, createdAt: { gte: previousActiveStart, lt: activeStart } },
    }),
    prisma.apiRequestLog.groupBy({
      by: ['hourBucket', 'apiKeyId', 'ipAddress'],
      where: { ...currentWhere, apiKeyId: { not: null } },
    }),
    prisma.apiRequestLog.groupBy({
      by: ['endpoint'],
      where: currentWhere,
      _count: { endpoint: true },
      orderBy: { _count: { endpoint: 'desc' } },
      take: 8,
    }),
    prisma.apiRequestLog.groupBy({
      by: ['countryCode'],
      where: currentWhere,
      _count: { _all: true },
    }),
    prisma.apiRequestLog.groupBy({
      by: ['apiKeyId', 'apiKeyLabel', 'apiKeyPrefix'],
      where: { ...currentWhere, apiKeyLabel: { not: null } },
      _count: { _all: true },
    }),
    prisma.apiRequestLog.groupBy({
      by: ['ipAddress'],
      where: currentWhere,
      _count: { _all: true },
      _avg: { durationMs: true },
      orderBy: { _count: { ipAddress: 'desc' } },
      take: 8,
    }),
  ])

  const topIpAddresses = (topIpRows as TopIpRow[]).map(row => row.ipAddress)
  const ipBreakdownRows = topIpAddresses.length
    ? await prisma.apiRequestLog.groupBy({
        by: ['ipAddress', 'status', 'cacheStatus', 'rateLimitSource'],
        where: { ...currentWhere, ipAddress: { in: topIpAddresses } },
        _count: { _all: true },
      })
    : []

  return {
    now,
    start,
    previousStatuses,
    previousCaches,
    activeClients,
    previousActiveClients,
    hourlyStatuses,
    hourlyCaches,
    hourlyClients,
    endpointRows,
    countryRows,
    keyRows,
    topIpRows,
    currentLatencySample,
    previousLatencySample,
    ipBreakdownRows,
  }
}

export async function warmUsageDashboardCache(range: UsageRange = '24h') {
  await usageAggregateCache.get(range, () => loadUsageAggregates(range))
}

export function clearUsageDashboardCache() {
  usageAggregateCache.clear()
}

export async function getUsageDashboard(input: DashboardInput = {}) {
  await requireAdmin()

  const range = parseUsageRange(input.range)
  const selectedStatus = statusFilter(input.status)
  const requestedCountry = input.country?.slice(0, 16) || 'all'
  const selectedCountry = requestedCountry === 'unknown'
    ? 'unknown'
    : /^[a-z]{2}$/i.test(requestedCountry)
      ? requestedCountry.toUpperCase()
      : 'all'
  const search = input.search?.trim().slice(0, 100) || ''
  const page = Math.max(1, Math.trunc(input.page || 1))
  const {
    now,
    start,
    previousStatuses,
    previousCaches,
    activeClients,
    previousActiveClients,
    hourlyStatuses,
    hourlyCaches,
    hourlyClients,
    endpointRows,
    countryRows,
    keyRows,
    topIpRows,
    currentLatencySample,
    previousLatencySample,
    ipBreakdownRows,
  } = await usageAggregateCache.get(range, () => loadUsageAggregates(range))

  const currentStatuses = hourlyStatuses as HourlyStatusRow[]
  const currentCaches = hourlyCaches as HourlyCacheRow[]
  const total = sumCounts(currentStatuses)
  const previousTotal = sumCounts(previousStatuses)
  const successful = statusCount(currentStatuses, status => status < 400)
  const previousSuccessful = statusCount(previousStatuses, status => status < 400)
  const hits = cacheCount(currentCaches, 'hit')
  const misses = cacheCount(currentCaches, 'miss')
  const previousHits = cacheCount(previousCaches, 'hit')
  const previousMisses = cacheCount(previousCaches, 'miss')
  const rateLimited = rateLimitCount(currentStatuses)
  const previousRateLimited = rateLimitCount(previousStatuses as RateLimitRow[])
  const tmdbRateLimited = rateLimitCount(currentStatuses, 'tmdb')
  const previousTmdbRateLimited = rateLimitCount(previousStatuses as RateLimitRow[], 'tmdb')
  const localRateLimited = rateLimitCount(currentStatuses, 'tmdb-service')
  const previousLocalRateLimited = rateLimitCount(previousStatuses as RateLimitRow[], 'tmdb-service')
  const successRate = percentage(successful, total)
  const previousSuccessRate = percentage(previousSuccessful, previousTotal)
  const cacheHitRate = percentage(hits, hits + misses)
  const previousCacheHitRate = percentage(previousHits, previousHits + previousMisses)

  const countries = countryRows
    .map(row => ({ code: row.countryCode, name: countryName(row.countryCode), count: row._count._all }))
    .sort((a, b) => b.count - a.count)

  const matchedCountries = search
    ? countries
        .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
        .map(item => item.code)
        .filter((code): code is string => Boolean(code))
    : []

  const liveNow = new Date()
  const liveStart = new Date(liveNow.getTime() - usageRangeHours(range) * HOUR_MS)
  const logCurrentWhere = { createdAt: { gte: liveStart, lte: liveNow } }
  const logWhereParts: Prisma.ApiRequestLogWhereInput[] = [logCurrentWhere]
  const selectedStatusWhere = statusWhere(selectedStatus)
  if (selectedStatus === '429') {
    logWhereParts.push({ OR: [{ status: 429 }, { rateLimitSource: { not: null } }] })
  } else if (selectedStatusWhere) logWhereParts.push(selectedStatusWhere)
  if (selectedCountry === 'unknown') logWhereParts.push({ countryCode: null })
  else if (/^[A-Z]{2}$/.test(selectedCountry)) logWhereParts.push({ countryCode: selectedCountry })
  if (search) {
    logWhereParts.push({
      OR: [
        { endpoint: { contains: search } },
        { query: { contains: search } },
        { ipAddress: { contains: search } },
        { apiKeyLabel: { contains: search } },
        { apiKeyPrefix: { contains: search } },
        { rateLimitSource: { contains: search } },
        ...(matchedCountries.length ? [{ countryCode: { in: matchedCountries } }] : []),
      ],
    })
  }
  const logWhere: Prisma.ApiRequestLogWhereInput = { AND: logWhereParts }
  const [logs, filteredTotal, blockedIpRows] = await Promise.all([
    prisma.apiRequestLog.findMany({
      where: logWhere,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.apiRequestLog.count({ where: logWhere }),
    prisma.blockedIp.findMany({ orderBy: { createdAt: 'desc' } }),
  ])

  const series = buildSeries(
    range,
    start,
    now,
    currentStatuses,
    currentCaches,
    hourlyClients as HourlyClientRow[],
  )
  const topEndpoints = endpointRows.map(row => ({
    endpoint: row.endpoint,
    count: row._count.endpoint,
    percent: percentage(row._count.endpoint, total),
  }))
  const topApiKeys = keyRows
    .map(row => ({
      id: row.apiKeyId,
      label: row.apiKeyLabel || 'Unknown key',
      prefix: row.apiKeyPrefix,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const ipStats = new Map<string, { successful: number; failed: number; rateLimited: number; hits: number; misses: number }>()
  for (const row of ipBreakdownRows as IpBreakdownRow[]) {
    const stats = ipStats.get(row.ipAddress) || { successful: 0, failed: 0, rateLimited: 0, hits: 0, misses: 0 }
    if (row.status < 400) stats.successful += row._count._all
    else stats.failed += row._count._all
    if (row.status === 429 || row.rateLimitSource !== null) stats.rateLimited += row._count._all
    if (row.cacheStatus === 'hit') stats.hits += row._count._all
    if (row.cacheStatus === 'miss') stats.misses += row._count._all
    ipStats.set(row.ipAddress, stats)
  }
  const blockedIpSet = new Set(blockedIpRows.map(row => row.address))
  const topIpAddressesWithStats = (topIpRows as TopIpRow[]).map(row => {
    const stats = ipStats.get(row.ipAddress) || { successful: 0, failed: 0, rateLimited: 0, hits: 0, misses: 0 }
    return {
      address: row.ipAddress,
      requests: row._count._all,
      percent: percentage(row._count._all, total),
      averageLatency: row._avg.durationMs || 0,
      successful: stats.successful,
      failed: stats.failed,
      rateLimited: stats.rateLimited,
      cacheHitRate: percentage(stats.hits, stats.hits + stats.misses),
      blocked: blockedIpSet.has(row.ipAddress),
    }
  })
  const statusBreakdown = [
    { label: '2xx', count: statusCount(currentStatuses, status => status >= 200 && status < 300) },
    { label: '4xx', count: statusCount(currentStatuses, status => status >= 400 && status < 500) },
    { label: '5xx', count: statusCount(currentStatuses, status => status >= 500 && status < 600) },
    { label: 'Other', count: statusCount(currentStatuses, status => status < 200 || (status >= 300 && status < 400) || status >= 600) },
  ]
  const p95Latency = percentile95(currentLatencySample.map(row => row.durationMs))
  const previousP95Latency = percentile95(previousLatencySample.map(row => row.durationMs))

  return {
    range,
    filters: { search, status: selectedStatus, country: selectedCountry, page },
    metrics: {
      requests: { value: total, change: percentChange(total, previousTotal), series: series.requests },
      activeClients: {
        value: activeClients.length,
        change: percentChange(activeClients.length, previousActiveClients.length),
        series: series.activeClients,
      },
      successRate: {
        value: successRate,
        change: successRate - previousSuccessRate,
        series: series.successRate,
      },
      cacheHitRate: {
        value: cacheHitRate,
        change: cacheHitRate - previousCacheHitRate,
        series: series.cacheHitRate,
      },
      p95Latency: { value: p95Latency, change: percentChange(p95Latency, previousP95Latency) },
      rateLimited: { value: rateLimited, change: percentChange(rateLimited, previousRateLimited) },
      tmdbRateLimited: {
        value: tmdbRateLimited,
        change: percentChange(tmdbRateLimited, previousTmdbRateLimited),
      },
      localRateLimited: {
        value: localRateLimited,
        change: percentChange(localRateLimited, previousLocalRateLimited),
      },
    },
    requestsOverTime: series.requests.map((value, index) => ({
      value,
      label: seriesLabel(series.dates[index], range),
    })),
    topEndpoints,
    countries: countries.map(item => ({ ...item, percent: percentage(item.count, total) })),
    statusBreakdown: statusBreakdown.map(item => ({ ...item, percent: percentage(item.count, total) })),
    topApiKeys: topApiKeys.map(item => ({ ...item, percent: percentage(item.count, total) })),
    topIpAddresses: topIpAddressesWithStats,
    blockedIps: blockedIpRows,
    logs,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: filteredTotal,
      totalPages: Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE)),
    },
  }
}

export type UsageDashboardData = Awaited<ReturnType<typeof getUsageDashboard>>
