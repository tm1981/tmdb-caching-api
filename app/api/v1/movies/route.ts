export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { paginationParams } from '@/lib/pagination'

export async function GET(req: NextRequest) {
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

  return NextResponse.json({
    data: movies,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
