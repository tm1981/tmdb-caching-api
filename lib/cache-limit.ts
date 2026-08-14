import prisma from '@/lib/prisma'
import { SEARCH_CAPTURE_PATH, SEARCH_MAPPING_PATH } from '@/lib/search-mappings'

const parsedLimit = Number(process.env.TMDB_CACHE_MAX_ROWS)

export const TMDB_CACHE_MAX_ROWS = Number.isInteger(parsedLimit) && parsedLimit > 0
  ? parsedLimit
  : 100_000

const EVICTION_BATCH_SIZE = 1_000
const ENFORCEMENT_INTERVAL_MS = 60_000
const OVERFLOW_RETRY_MS = 1_000

export const PRESERVED_TMDB_CACHE_PATHS = [SEARCH_MAPPING_PATH, SEARCH_CAPTURE_PATH]

let enforcementPromise: Promise<void> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let lastEnforcementStartedAt = 0
let clearInProgress = false
let clearPromise: Promise<CachedDataClearResult> | null = null

type CachedDataClearResult = {
  mirror: number
  movies: number
  tvShows: number
  total: number
}

export async function getCachedDataCounts() {
  // Maintenance queries stay sequential so they never reserve several pool connections at once.
  const mirror = await prisma.tmdbCache.count({
    where: { path: { notIn: PRESERVED_TMDB_CACHE_PATHS } },
  })
  const movies = await prisma.movie.count()
  const tvShows = await prisma.tvShow.count()

  return {
    mirror,
    movies,
    tvShows,
    total: mirror + movies + tvShows,
  }
}

async function deleteOldestMirrorRows(count: number) {
  const rows = await prisma.tmdbCache.findMany({
    where: { path: { notIn: PRESERVED_TMDB_CACHE_PATHS } },
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: count,
    select: { id: true },
  })

  if (!rows.length) return 0
  return (await prisma.tmdbCache.deleteMany({
    where: { id: { in: rows.map(row => row.id) } },
  })).count
}

async function deleteOldestMovieRows(count: number) {
  const rows = await prisma.movie.findMany({
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: count,
    select: { id: true },
  })

  if (!rows.length) return 0
  return (await prisma.movie.deleteMany({
    where: { id: { in: rows.map(row => row.id) } },
  })).count
}

async function deleteOldestTvShowRows(count: number) {
  const rows = await prisma.tvShow.findMany({
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: count,
    select: { id: true },
  })

  if (!rows.length) return 0
  return (await prisma.tvShow.deleteMany({
    where: { id: { in: rows.map(row => row.id) } },
  })).count
}

async function deleteOldestNormalizedRows(count: number) {
  const candidateCount = Math.min(count, EVICTION_BATCH_SIZE)
  const movies = await prisma.movie.findMany({
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: candidateCount,
    select: { id: true, updatedAt: true },
  })
  const tvShows = await prisma.tvShow.findMany({
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    take: candidateCount,
    select: { id: true, updatedAt: true },
  })

  const oldest = [
    ...movies.map(row => ({ ...row, type: 'movie' as const })),
    ...tvShows.map(row => ({ ...row, type: 'tv' as const })),
  ]
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || a.id - b.id)
    .slice(0, count)

  const movieIds = oldest.filter(row => row.type === 'movie').map(row => row.id)
  const tvShowIds = oldest.filter(row => row.type === 'tv').map(row => row.id)
  let deleted = 0

  if (movieIds.length) {
    deleted += (await prisma.movie.deleteMany({ where: { id: { in: movieIds } } })).count
  }
  if (tvShowIds.length) {
    deleted += (await prisma.tvShow.deleteMany({ where: { id: { in: tvShowIds } } })).count
  }

  return deleted
}

async function enforceOneBatch() {
  const counts = await getCachedDataCounts()
  const overflow = Math.max(0, counts.total - TMDB_CACHE_MAX_ROWS)
  if (!overflow) return { deleted: 0, remainingOverflow: 0 }

  const batchSize = Math.min(overflow, EVICTION_BATCH_SIZE)
  const mirrorDeleted = await deleteOldestMirrorRows(batchSize)
  const normalizedDeleted = mirrorDeleted < batchSize
    ? await deleteOldestNormalizedRows(batchSize - mirrorDeleted)
    : 0

  return {
    deleted: mirrorDeleted + normalizedDeleted,
    remainingOverflow: Math.max(0, overflow - mirrorDeleted - normalizedDeleted),
  }
}

function queueOverflowRetry() {
  if (retryTimer || clearInProgress) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    scheduleCachedDataLimitEnforcement(true)
  }, OVERFLOW_RETRY_MS)
  retryTimer.unref()
}

export function scheduleCachedDataLimitEnforcement(force = false) {
  if (clearInProgress || enforcementPromise) return

  const now = Date.now()
  if (!force && now - lastEnforcementStartedAt < ENFORCEMENT_INTERVAL_MS) return
  lastEnforcementStartedAt = now

  let remainingOverflow = 0
  let deleted = 0
  enforcementPromise = enforceOneBatch()
    .then(result => {
      deleted = result.deleted
      remainingOverflow = result.remainingOverflow
    })
    .catch(error => {
      console.warn('Database cache limit enforcement failed:', error)
    })
    .finally(() => {
      enforcementPromise = null
      // A zero-progress batch should not create an endless retry loop.
      // A later cache write will schedule another ordinary check.
      if (deleted > 0 && remainingOverflow > 0) queueOverflowRetry()
    })
}

async function clearTableInBatches(deleteBatch: (count: number) => Promise<number>) {
  let deleted = 0
  while (true) {
    const batchDeleted = await deleteBatch(EVICTION_BATCH_SIZE)
    deleted += batchDeleted
    if (batchDeleted < EVICTION_BATCH_SIZE) return deleted
  }
}

async function performCachedDataClear(): Promise<CachedDataClearResult> {
  clearInProgress = true
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }

  try {
    await enforcementPromise
    const mirror = await clearTableInBatches(deleteOldestMirrorRows)
    const movies = await clearTableInBatches(deleteOldestMovieRows)
    const tvShows = await clearTableInBatches(deleteOldestTvShowRows)
    lastEnforcementStartedAt = Date.now()
    return { mirror, movies, tvShows, total: mirror + movies + tvShows }
  } finally {
    clearInProgress = false
  }
}

export function clearCachedData(): Promise<CachedDataClearResult> {
  if (clearPromise) return clearPromise

  clearPromise = performCachedDataClear().finally(() => {
    clearPromise = null
  })
  return clearPromise
}
