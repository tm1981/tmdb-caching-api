export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const query = searchParams.get('q') || ''
  const apiKey = req.headers.get('x-api-key') || ''

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    )
  }

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
