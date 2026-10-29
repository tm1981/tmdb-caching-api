import { after } from 'next/server'
import prisma from '@/lib/prisma'
import { DETAIL_TTL_MS, isCacheStale } from '@/lib/cache-ttl'
import { extractMovieData, extractTvDataFull, getMovieDetails, getTvDetails } from '@/lib/tmdb'

// Single-flight per process so a burst of stale hits triggers one upstream refetch.
const refreshes = new Map<string, Promise<void>>()

function refreshInBackground(key: string, load: () => Promise<unknown>) {
  after(async () => {
    if (refreshes.has(key)) return
    // Failed refetches keep serving the stale row.
    const refresh = load()
      .then(() => undefined)
      .catch(error => console.warn(`Background refresh failed for ${key}:`, error))
      .finally(() => refreshes.delete(key))
    refreshes.set(key, refresh)
    await refresh
  })
}

export function isStaleDetail(updatedAt: Date) {
  return isCacheStale(updatedAt, DETAIL_TTL_MS)
}

export function refreshMovieInBackground(tmdbId: number) {
  refreshInBackground(`movie:${tmdbId}`, async () => {
    const movieData = extractMovieData(await getMovieDetails(tmdbId))
    await prisma.movie.update({ where: { tmdbId }, data: movieData })
  })
}

export function refreshTvInBackground(tmdbId: number) {
  refreshInBackground(`tv:${tmdbId}`, async () => {
    const tvData = await extractTvDataFull(await getTvDetails(tmdbId), tmdbId)
    await prisma.tvShow.update({ where: { tmdbId }, data: tvData })
  })
}
