export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { getMovieDetails, searchMovie, getPosterPath } from '@/lib/tmdb'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const apiKey = req.headers.get('x-api-key') || ''

  if (!query) {
    return NextResponse.json(
      { error: 'Search query "q" is required' },
      { status: 400 }
    )
  }

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    )
  }

  const where: any = {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { name: { contains: query, mode: 'insensitive' } },
    ],
  }

  const [movies, tvShows] = await Promise.all([
    prisma.movie.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { originalTitle: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { title: 'asc' },
      select: {
        id: true,
        tmdbId: true,
        title: true,
        overview: true,
        posterPath: true,
        releaseDate: true,
        voteAverage: true,
        voteCount: true,
      },
    }),
    prisma.tvShow.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { originalName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        tmdbId: true,
        name: true,
        overview: true,
        posterPath: true,
        firstAirDate: true,
        voteAverage: true,
        voteCount: true,
      },
    }),
  ])

  return NextResponse.json({
    data: {
      movies: movies.map((m) => ({
        ...m,
        posterUrl: getPosterPath(m.posterPath),
      })),
      tvShows: tvShows.map((t) => ({
        ...t,
        posterUrl: getPosterPath(t.posterPath),
      })),
    },
  })
}
