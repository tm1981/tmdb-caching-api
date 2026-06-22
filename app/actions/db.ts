'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
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
  return prisma.movie.findUnique({
    where: { tmdbId: id },
  })
}

export async function deleteMovie(tmdbId: number) {
  await prisma.movie.delete({
    where: { tmdbId },
  })
  revalidatePath('/admin/movies')
}

// TV Shows
export async function getTvShows(page = 1, limit = 20, query = '') {
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
  return prisma.tvShow.findUnique({
    where: { tmdbId: id },
  })
}

export async function deleteTvShow(tmdbId: number) {
  await prisma.tvShow.delete({
    where: { tmdbId },
  })
  revalidatePath('/admin/tv')
}

// API Keys
export async function getApiKeys() {
  return prisma.apiKey.findMany({
    include: { owner: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createApiKey(label: string) {
  const crypto = await import('crypto')
  const key = crypto.randomBytes(32).toString('hex')

  return prisma.apiKey.create({
    data: {
      key,
      label,
      active: true,
      ownerId: 1,
    },
  })
}

export async function toggleApiKey(id: number) {
  const existing = await prisma.apiKey.findUnique({ where: { id } })
  await prisma.apiKey.update({
    where: { id },
    data: { active: !existing?.active },
  })
  revalidatePath('/admin/keys')
}

export async function deleteApiKey(id: number) {
  await prisma.apiKey.delete({ where: { id } })
  revalidatePath('/admin/keys')
}

// Sync Logs
export async function getSyncLogs(limit = 50) {
  return prisma.syncLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
}

// Sync Operations
export async function syncTrendingMovies() {
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
