export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { containsText } from '@/lib/text-search'
import { MAX_PAGE, pageOutOfRangeResponse, paginationParams } from '@/lib/pagination'
import { withApiUsage } from '@/lib/api-usage'
import { LOCAL_LIST_CACHE_CONTROL } from '@/lib/cache-ttl'

async function getTvShows(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams

  const { page, limit, skip } = paginationParams(
    searchParams.get('page') || undefined,
    searchParams.get('limit') || undefined,
  )
  if (page > MAX_PAGE) return pageOutOfRangeResponse(MAX_PAGE)
  const query = searchParams.get('q') || ''
  const where: Prisma.TvShowWhereInput = {}
  if (query) {
    where.OR = [
      { name: containsText(query) },
      { originalName: containsText(query) },
    ]
  }

  const [tvShows, total] = await Promise.all([
    prisma.tvShow.findMany({
      where,
      skip,
      take: limit,
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
    prisma.tvShow.count({ where }),
  ])

  return NextResponse.json(
    {
      data: tvShows,
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

export const GET = withApiUsage(getTvShows)
