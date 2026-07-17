export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { getPosterPath } from '@/lib/tmdb'
import { canonicalParams, getCachedTmdb } from '@/lib/tmdb-cache'
import { withApiUsage } from '@/lib/api-usage'
import {
  applyManualSearchMapping,
  manualSearchCacheKey,
  MAX_TMDB_CACHE_KEY_LENGTH,
  parseManualSearchMapping,
} from '@/lib/search-mappings'

type TmdbSearchItem = {
  id: number
  media_type: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  profile_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  vote_count?: number
  popularity?: number
  known_for_department?: string
}

type TmdbSearchResponse = {
  page: number
  results: TmdbSearchItem[]
  total_pages: number
  total_results: number
}

async function search(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const query = (searchParams.get('q') || '').trim()
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

  const page = Math.max(parseInt(searchParams.get('page') || '1') || 1, 1)
  const tmdbParams = {
    query,
    page,
    language: 'en-US',
    include_adult: 'false',
  }
  if (`/search/multi?${canonicalParams(tmdbParams)}`.length > MAX_TMDB_CACHE_KEY_LENGTH) {
    return NextResponse.json({ error: 'Search query is too long' }, { status: 414 })
  }
  const mappingKey = manualSearchCacheKey(query)

  const [movies, tvShows, tmdb, mappingRow] = await Promise.all([
    prisma.movie.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { originalTitle: { contains: query } },
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
          { name: { contains: query } },
          { originalName: { contains: query } },
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
    getCachedTmdb<TmdbSearchResponse>('/search/multi', tmdbParams),
    mappingKey.length <= MAX_TMDB_CACHE_KEY_LENGTH
      ? prisma.tmdbCache.findUnique({
          where: { cacheKey: mappingKey },
          select: { payload: true },
        })
      : Promise.resolve(null),
  ])

  const manualMapping = parseManualSearchMapping(mappingRow?.payload)
  const tmdbPayload = applyManualSearchMapping(tmdb.payload, manualMapping) as TmdbSearchResponse
  const tmdbResults = tmdbPayload.results || []
  const tmdbMovies = tmdbResults.filter((item) => item.media_type === 'movie')
  const tmdbTvShows = tmdbResults.filter((item) => item.media_type === 'tv')
  const tmdbPeople = tmdbResults.filter((item) => item.media_type === 'person')

  return NextResponse.json({
    data: {
      movies: movies.map((m) => ({
        ...m,
        source: 'local',
        posterUrl: getPosterPath(m.posterPath),
      })),
      tvShows: tvShows.map((t) => ({
        ...t,
        source: 'local',
        posterUrl: getPosterPath(t.posterPath),
      })),
      tmdb: {
        cache: tmdb.cache,
        page: tmdbPayload.page,
        totalPages: tmdbPayload.total_pages,
        totalResults: tmdbPayload.total_results,
        movies: tmdbMovies.map((m) => ({
          source: 'tmdb',
          tmdbId: m.id,
          title: m.title,
          originalTitle: m.original_title,
          overview: m.overview,
          posterPath: m.poster_path,
          posterUrl: getPosterPath(m.poster_path || null),
          releaseDate: m.release_date || null,
          voteAverage: m.vote_average ?? null,
          voteCount: m.vote_count ?? null,
          popularity: m.popularity ?? null,
        })),
        tvShows: tmdbTvShows.map((t) => ({
          source: 'tmdb',
          tmdbId: t.id,
          name: t.name,
          originalName: t.original_name,
          overview: t.overview,
          posterPath: t.poster_path,
          posterUrl: getPosterPath(t.poster_path || null),
          firstAirDate: t.first_air_date || null,
          voteAverage: t.vote_average ?? null,
          voteCount: t.vote_count ?? null,
          popularity: t.popularity ?? null,
        })),
        people: tmdbPeople.map((p) => ({
          source: 'tmdb',
          tmdbId: p.id,
          name: p.name,
          profilePath: p.profile_path,
          profileUrl: getPosterPath(p.profile_path || null),
          knownForDepartment: p.known_for_department || null,
          popularity: p.popularity ?? null,
        })),
      },
    },
  }, { headers: { 'x-tmdb-cache': tmdb.cache } })
}

export const GET = withApiUsage(search)
