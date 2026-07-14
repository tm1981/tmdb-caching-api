export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { paginationParams } from '@/lib/pagination'
import { withApiUsage } from '@/lib/api-usage'

async function getTvShows(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams

  const { page, limit, skip } = paginationParams(
    searchParams.get('page') || undefined,
    searchParams.get('limit') || undefined,
  )
  const query = searchParams.get('q') || ''
  const apiKey = req.headers.get('x-api-key') || ''

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    )
  }

  const where: any = {}
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { originalName: { contains: query } },
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
    { headers: { 'x-tmdb-cache': 'hit' } },
  )
}

export const GET = withApiUsage(getTvShows)
