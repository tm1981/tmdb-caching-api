export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getMovieDetails, extractMovieData } from '@/lib/tmdb'
import { withApiUsage } from '@/lib/api-usage'
import { scheduleCachedDataLimitEnforcement } from '@/lib/cache-limit'
import { retryPrismaUniqueConflict } from '@/lib/prisma-conflict'
import { tmdbFetchErrorResponse } from '@/lib/tmdb-errors'
import { parseTmdbId } from '@/lib/tmdb-path'

async function getMovie(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const tmdbId = parseTmdbId(id)

  if (!tmdbId) {
    return NextResponse.json({ error: 'Invalid movie ID' }, { status: 400 })
  }

  let movie = await prisma.movie.findUnique({
    where: { tmdbId },
  })
  let cacheStatus = 'hit'

  if (!movie) {
    cacheStatus = 'miss'
    let data: Awaited<ReturnType<typeof getMovieDetails>>
    try {
      data = await getMovieDetails(tmdbId)
    } catch (error) {
      return tmdbFetchErrorResponse(error, 'Movie')
    }

    const movieData = extractMovieData(data)
    // Concurrent requests for the same uncached movie race to insert; the loser reads the winner's row.
    movie = await retryPrismaUniqueConflict(
      () => prisma.movie.create({ data: movieData }),
      () => prisma.movie.findUniqueOrThrow({ where: { tmdbId: movieData.tmdbId } }),
    )
    scheduleCachedDataLimitEnforcement()

    await prisma.syncLog.create({
      data: {
        type: 'movie',
        tmdbId: data.id,
        status: 'success',
        detail: `Lazy-synced movie: ${data.title}`,
      },
    }).catch(error => console.warn('Sync log write failed:', error))
  }

  // Mirror TMDB API response format
  const cast = movie.cast as Array<{ id: number; name: string; character: string; profilePath: string | null; order: number }> | null
  const crew = movie.crew as Array<{ id: number; name: string; job: string; department: string; profilePath: string | null }> | null
  const videos = movie.videos as Array<{ key: string; name: string; site: string; type: string; size: number }> | null

  return NextResponse.json({
    adult: false,
    backdrop_path: movie.backdropPath,
    belongs_to_collection: null,
    budget: 0,
    genres: (movie.genres as Array<{ id: number; name: string }>) || [],
    homepage: '',
    id: movie.tmdbId,
    imdb_id: movie.imdbId,
    original_language: '',
    original_title: movie.originalTitle,
    overview: movie.overview,
    popularity: 0,
    poster_path: movie.posterPath,
    production_companies: (movie.productionCompanies as Array<{ id: number; logo_path: string | null; name: string; origin_country: string }>) || [],
    production_countries: [],
    release_date: movie.releaseDate ? movie.releaseDate.toISOString().split('T')[0] : null,
    revenue: 0,
    runtime: movie.runtime,
    spoken_languages: (movie.spokenLanguages as Array<{ english_name: string; iso_639_1: string; name: string }>) || [],
    status: movie.status,
    tagline: movie.tagline,
    title: movie.title,
    video: false,
    vote_average: movie.voteAverage,
    vote_count: movie.voteCount,
    credits: {
      cast: cast?.map(c => ({
        id: c.id,
        cast_id: c.order,
        character: c.character,
        name: c.name,
        order: c.order,
        profile_path: c.profilePath,
      })) || [],
      crew: crew?.map(c => ({
        id: c.id,
        department: c.department,
        job: c.job,
        name: c.name,
        profile_path: c.profilePath,
      })) || [],
    },
    videos: {
      results: videos?.map(v => ({
        iso_639_1: '',
        iso_3166_1: '',
        key: v.key,
        name: v.name,
        site: v.site,
        size: v.size,
        type: v.type,
      })) || [],
    },
    images: {
      posters: [],
      backdrops: [],
    },
  }, { headers: { 'x-tmdb-cache': cacheStatus } })
}

export const GET = withApiUsage(getMovie)
