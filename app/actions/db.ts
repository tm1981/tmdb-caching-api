'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { hashApiKey } from '@/lib/api-keys'
import prisma from '@/lib/prisma'
import { getCachedTmdb } from '@/lib/tmdb-cache'
import {
  searchMovie,
  searchTv,
  getMovieDetails,
  getTvDetails,
  getTrendingMovies,
  getTrendingTv,
  getTopRatedMovies,
  getTopRatedTv,
  extractMovieData,
  extractTvDataFull,
} from '@/lib/tmdb'

// Movies
export async function getMovies(page = 1, limit = 20, query = '') {
  await requireAdmin()
  const skip = (page - 1) * limit

  const where: any = {}
  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { originalTitle: { contains: query, mode: 'insensitive' } },
    ]
  }

  const [movies, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      skip,
      take: limit,
      orderBy: { title: 'asc' },
    }),
    prisma.movie.count({ where }),
  ])

  return { movies, total, totalPages: Math.ceil(total / limit) }
}

export async function getMovieById(id: number) {
  await requireAdmin()
  return prisma.movie.findUnique({
    where: { tmdbId: id },
  })
}

export async function deleteMovie(tmdbId: number) {
  await requireAdmin()
  await prisma.movie.delete({
    where: { tmdbId },
  })
  revalidatePath('/admin/movies')
}

// TV Shows
export async function getTvShows(page = 1, limit = 20, query = '') {
  await requireAdmin()
  const skip = (page - 1) * limit

  const where: any = {}
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { originalName: { contains: query, mode: 'insensitive' } },
    ]
  }

  const [tvShows, total] = await Promise.all([
    prisma.tvShow.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.tvShow.count({ where }),
  ])

  return { tvShows, total, totalPages: Math.ceil(total / limit) }
}

export async function getTvShowById(id: number) {
  await requireAdmin()
  return prisma.tvShow.findUnique({
    where: { tmdbId: id },
  })
}

export async function deleteTvShow(tmdbId: number) {
  await requireAdmin()
  await prisma.tvShow.delete({
    where: { tmdbId },
  })
  revalidatePath('/admin/tv')
}

// API Keys
export async function getApiKeys() {
  await requireAdmin()
  return prisma.apiKey.findMany({
    include: { owner: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createApiKey(label: string) {
  await requireAdmin()
  const crypto = await import('crypto')
  const key = crypto.randomBytes(32).toString('hex')
  const keyHash = await hashApiKey(key)

  const apiKey = await prisma.apiKey.create({
    data: {
      keyHash,
      keyPrefix: key.slice(0, 12),
      label,
      active: true,
      ownerId: 1,
    },
  })

  return { ...apiKey, key }
}

export async function toggleApiKey(id: number) {
  await requireAdmin()
  const existing = await prisma.apiKey.findUnique({ where: { id } })
  await prisma.apiKey.update({
    where: { id },
    data: { active: !existing?.active },
  })
  revalidatePath('/admin/keys')
}

export async function deleteApiKey(id: number) {
  await requireAdmin()
  await prisma.apiKey.delete({ where: { id } })
  revalidatePath('/admin/keys')
}

// Sync Logs
export async function getSyncLogs(limit = 50) {
  await requireAdmin()
  return prisma.syncLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTmdbCacheStats() {
  await requireAdmin()
  const [total, latest, recent] = await Promise.all([
    prisma.tmdbCache.count(),
    prisma.tmdbCache.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    // ponytail: sample recent rows; use SQL grouping if the cache grows large.
    prisma.tmdbCache.findMany({
      take: 1000,
      orderBy: { updatedAt: 'desc' },
      select: { path: true },
    }),
  ])

  const roots = new Map<string, number>()
  for (const item of recent) {
    const root = item.path.split('/').filter(Boolean)[0] || '/'
    roots.set(root, (roots.get(root) || 0) + 1)
  }

  return {
    total,
    lastUpdatedAt: latest?.updatedAt ?? null,
    topRoots: [...roots.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, count]) => ({ path: `/${path}`, count })),
  }
}

const tmdbWarmups = {
  core: [
    ['/configuration', {}, false],
    ['/genre/movie/list', { language: 'en-US' }, false],
    ['/genre/tv/list', { language: 'en-US' }, false],
    ['/watch/providers/regions', { language: 'en-US' }, false],
    ['/watch/providers/movie', { language: 'en-US' }, false],
    ['/watch/providers/tv', { language: 'en-US' }, false],
  ],
  trending: [
    ['/trending/all/day', { language: 'en-US' }, true],
    ['/trending/movie/day', { language: 'en-US' }, true],
    ['/trending/tv/day', { language: 'en-US' }, true],
    ['/trending/person/day', { language: 'en-US' }, true],
  ],
  popular: [
    ['/movie/popular', { language: 'en-US' }, true],
    ['/tv/popular', { language: 'en-US' }, true],
    ['/movie/top_rated', { language: 'en-US' }, true],
    ['/tv/top_rated', { language: 'en-US' }, true],
  ],
} satisfies Record<string, Array<[string, Record<string, string>, boolean]>>

export type TmdbWarmupType = keyof typeof tmdbWarmups

export async function warmupTmdbCache(type: TmdbWarmupType, pages = 1) {
  await requireAdmin()
  const endpoints = tmdbWarmups[type]
  const pageCount = Math.min(Math.max(Math.trunc(pages) || 1, 1), 20)
  let success = 0
  let errors = 0

  for (const [endpoint, baseParams, paginated] of endpoints) {
    for (let page = 1; page <= (paginated ? pageCount : 1); page++) {
      const params = paginated ? { ...baseParams, page: String(page) } : baseParams
      const result = await getCachedTmdb(endpoint, params, true)

      if (result.cache === 'bypass') {
        errors++
        continue
      }
      success++
    }
  }

  await prisma.syncLog.create({
    data: {
      type: 'tmdb-cache',
      status: errors ? 'partial' : 'success',
      detail: `Warmed ${success} ${type} TMDB cache endpoints (${errors} errors, ${pageCount} page limit)`,
    },
  })

  revalidatePath('/admin/sync')
  return { success, errors }
}

export async function refreshMovieFromTmdb(tmdbId: number) {
  await requireAdmin()
  const data = await getMovieDetails(tmdbId)
  const movieData = extractMovieData(data)
  await prisma.movie.upsert({
    where: { tmdbId: data.id },
    create: movieData,
    update: movieData,
  })
  await getCachedTmdb(`/movie/${tmdbId}`, { append_to_response: 'credits,videos', language: 'en-US' }, true)
  revalidatePath(`/admin/movies/${tmdbId}`)
  revalidatePath('/admin/movies')
  return { success: 1, errors: 0 }
}

export async function refreshTvFromTmdb(tmdbId: number) {
  await requireAdmin()
  const data = await getTvDetails(tmdbId)
  const tvData = await extractTvDataFull(data, tmdbId)
  await prisma.tvShow.upsert({
    where: { tmdbId: data.id },
    create: tvData,
    update: tvData,
  })
  await getCachedTmdb(`/tv/${tmdbId}`, { append_to_response: 'credits,videos', language: 'en-US' }, true)
  revalidatePath(`/admin/tv/${tmdbId}`)
  revalidatePath('/admin/tv')
  return { success: 1, errors: 0 }
}

export async function refreshPersonFromTmdb(personId: number) {
  await requireAdmin()
  await getCachedTmdb(
    `/person/${personId}`,
    { append_to_response: 'combined_credits,images,external_ids', language: 'en-US' },
    true,
  )
  revalidatePath(`/admin/people/${personId}`)
  return { success: 1, errors: 0 }
}

// Sync Operations
export async function syncTrendingMovies() {
  await requireAdmin()
  const { results } = await getTrendingMovies('day')
  let success = 0
  let errors = 0

  for (const item of results) {
    try {
      const data = await getMovieDetails(item.id)
      const movieData = extractMovieData(data)
      await prisma.movie.upsert({
        where: { tmdbId: data.id },
        create: movieData,
        update: movieData,
      })
      success++
    } catch {
      errors++
    }
  }

  await prisma.syncLog.create({
    data: {
      type: 'bulk',
      status: 'success',
      detail: `Synced ${success} trending movies (${errors} errors)`,
    },
  })

  revalidatePath('/admin/sync')
  revalidatePath('/admin/movies')
  return { success, errors }
}

export async function syncTrendingTv() {
  await requireAdmin()
  const { results } = await getTrendingTv('day')
  let success = 0
  let errors = 0

  for (const item of results) {
    try {
      const data = await getTvDetails(item.id)
      const tvData = await extractTvDataFull(data, item.id)
      await prisma.tvShow.upsert({
        where: { tmdbId: data.id },
        create: tvData,
        update: tvData,
      })
      success++
    } catch {
      errors++
    }
  }

  await prisma.syncLog.create({
    data: {
      type: 'bulk',
      status: 'success',
      detail: `Synced ${success} trending TV shows (${errors} errors)`,
    },
  })

  revalidatePath('/admin/sync')
  revalidatePath('/admin/tv')
  return { success, errors }
}

export async function syncTopRatedMovies() {
  await requireAdmin()
  const { results } = await getTopRatedMovies(1)
  let success = 0
  let errors = 0

  for (const item of results) {
    try {
      const data = await getMovieDetails(item.id)
      const movieData = extractMovieData(data)
      await prisma.movie.upsert({
        where: { tmdbId: data.id },
        create: movieData,
        update: movieData,
      })
      success++
    } catch {
      errors++
    }
  }

  await prisma.syncLog.create({
    data: {
      type: 'bulk',
      status: 'success',
      detail: `Synced ${success} top rated movies (${errors} errors)`,
    },
  })

  revalidatePath('/admin/sync')
  revalidatePath('/admin/movies')
  return { success, errors }
}

export async function syncTopRatedTv() {
  await requireAdmin()
  const { results } = await getTopRatedTv(1)
  let success = 0
  let errors = 0

  for (const item of results) {
    try {
      const data = await getTvDetails(item.id)
      const tvData = await extractTvDataFull(data, item.id)
      await prisma.tvShow.upsert({
        where: { tmdbId: data.id },
        create: tvData,
        update: tvData,
      })
      success++
    } catch {
      errors++
    }
  }

  await prisma.syncLog.create({
    data: {
      type: 'bulk',
      status: 'success',
      detail: `Synced ${success} top rated TV shows (${errors} errors)`,
    },
  })

  revalidatePath('/admin/sync')
  revalidatePath('/admin/tv')
  return { success, errors }
}
