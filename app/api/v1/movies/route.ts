export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { MAX_PAGE, pageOutOfRangeResponse, paginationParams } from '@/lib/pagination'
import { withApiUsage } from '@/lib/api-usage'
import { LOCAL_LIST_CACHE_CONTROL } from '@/lib/cache-ttl'

async function getMovies(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams

  const { page, limit, skip } = paginationParams(
    searchParams.get('page') || undefined,
    searchParams.get('limit') || undefined,
  )
  if (page > MAX_PAGE) return pageOutOfRangeResponse(MAX_PAGE)
  const query = searchParams.get('q') || ''
  const where: any = {}
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { originalTitle: { contains: query } },
    ]
  }

  const [movies, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      skip,
      take: limit,
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
    prisma.movie.count({ where }),
  ])

  return NextResponse.json(
    {
      data: movies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    { headers: { 'x-tmdb-cache': 'hit', 'cache-control': LOCAL_LIST_CACHE_CONTROL } },
  )
}

export const GET = withApiUsage(getMovies)
