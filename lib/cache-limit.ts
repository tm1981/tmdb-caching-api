import prisma from '@/lib/prisma'
import { SEARCH_CAPTURE_PATH, SEARCH_MAPPING_PATH } from '@/lib/search-mappings'

const parsedLimit = Number(process.env.TMDB_CACHE_MAX_ROWS)

export const TMDB_CACHE_MAX_ROWS = Number.isInteger(parsedLimit) && parsedLimit > 0
  ? parsedLimit
  : 100_000

const EVICTION_BATCH_SIZE = 1_000
export const PRESERVED_TMDB_CACHE_PATHS = [SEARCH_MAPPING_PATH, SEARCH_CAPTURE_PATH]

export async function getCachedDataCounts() {
  const [mirror, movies, tvShows] = await Promise.all([
    prisma.tmdbCache.count({ where: { path: { notIn: PRESERVED_TMDB_CACHE_PATHS } } }),
    prisma.movie.count(),
    prisma.tvShow.count(),
  ])

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
  const result = await prisma.tmdbCache.deleteMany({
    where: { id: { in: rows.map(row => row.id) } },
  })
  return result.count
}

async function deleteOldestNormalizedRows(count: number) {
  const candidateCount = Math.min(count, EVICTION_BATCH_SIZE)
  const [movies, tvShows] = await Promise.all([
    prisma.movie.findMany({
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: candidateCount,
      select: { id: true, updatedAt: true },
    }),
    prisma.tvShow.findMany({
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: candidateCount,
      select: { id: true, updatedAt: true },
    }),
  ])

  const oldest = [
    ...movies.map(row => ({ ...row, type: 'movie' as const })),
    ...tvShows.map(row => ({ ...row, type: 'tv' as const })),
  ]
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || a.id - b.id)
    .slice(0, count)

  const movieIds = oldest.filter(row => row.type === 'movie').map(row => row.id)
  const tvShowIds = oldest.filter(row => row.type === 'tv').map(row => row.id)
  const [deletedMovies, deletedTvShows] = await prisma.$transaction([
    prisma.movie.deleteMany({ where: { id: { in: movieIds } } }),
    prisma.tvShow.deleteMany({ where: { id: { in: tvShowIds } } }),
  ])

  return deletedMovies.count + deletedTvShows.count
}

export async function enforceCachedDataLimit() {
  const counts = await getCachedDataCounts()
  let overflow = counts.total - TMDB_CACHE_MAX_ROWS
  let deleted = 0

  while (overflow > 0) {
    const batchSize = Math.min(overflow, EVICTION_BATCH_SIZE)
    const mirrorDeleted = await deleteOldestMirrorRows(batchSize)
    deleted += mirrorDeleted
    overflow -= mirrorDeleted

    if (overflow <= 0) break

    const normalizedDeleted = await deleteOldestNormalizedRows(
      Math.min(overflow, EVICTION_BATCH_SIZE),
    )
    deleted += normalizedDeleted
    overflow -= normalizedDeleted

    if (mirrorDeleted + normalizedDeleted === 0) break
  }

  return { deleted, limit: TMDB_CACHE_MAX_ROWS }
}

