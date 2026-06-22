export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getTvDetails, extractTvDataFull } from '@/lib/tmdb'
import { checkRateLimit } from '@/lib/ratelimit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const apiKey = req.headers.get('x-api-key') || ''

  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    )
  }

  const tmdbId = parseInt(id)

  if (isNaN(tmdbId)) {
    return NextResponse.json({ error: 'Invalid TV show ID' }, { status: 400 })
  }

  let tvShow = await prisma.tvShow.findUnique({
    where: { tmdbId },
  })

  if (!tvShow) {
    try {
      const data = await getTvDetails(tmdbId)
      const tvData = await extractTvDataFull(data, tmdbId)

      tvShow = await prisma.tvShow.create({
        data: tvData,
      })

      await prisma.syncLog.create({
        data: {
          type: 'tv',
          tmdbId: data.id,
          status: 'success',
          detail: `Lazy-synced TV show: ${data.name}`,
        },
      })
    } catch (error: any) {
      return NextResponse.json(
        { error: `Failed to fetch TV show from TMDB: ${error.message}` },
        { status: 502 }
      )
    }
  }

  // Mirror TMDB API response format
  const cast = tvShow.cast as Array<{ id: number; name: string; character: string; profilePath: string | null; order: number }> | null
  const crew = tvShow.crew as Array<{ id: number; name: string; job: string; department: string; profilePath: string | null }> | null
  const videos = tvShow.videos as Array<{ key: string; name: string; site: string; type: string; size: number }> | null
  const originCountry = tvShow.originCountry as string[] | null
  const seasons = tvShow.seasons as Array<any> | null

  return NextResponse.json({
    backdrop_path: tvShow.backdropPath,
    created_by: [],
    episode_run_time: [],
    first_air_date: tvShow.firstAirDate ? tvShow.firstAirDate.toISOString().split('T')[0] : null,
    genres: (tvShow.genres as Array<{ id: number; name: string }>) || [],
    homepage: '',
    id: tvShow.tmdbId,
    in_production: tvShow.status === 'Returning Series',
    languages: [tvShow.spokenLanguage || 'en'],
    last_air_date: null,
    last_episode_to_air: null,
    name: tvShow.name,
    next_episode_to_air: null,
    networks: [],
    number_of_episodes: tvShow.numberOfEpisodes,
    number_of_seasons: tvShow.numberOfSeasons,
    origin_country: originCountry || [],
    original_language: tvShow.spokenLanguage || 'en',
    original_name: tvShow.originalName,
    overview: tvShow.overview,
    popularity: 0,
    poster_path: tvShow.posterPath,
    production_companies: [],
    production_countries: [],
    seasons: seasons?.map(s => ({
      air_date: s.airDate,
      episode_count: s.episodeCount,
      id: s.id,
      name: s.name,
      overview: s.overview,
      poster_path: s.posterPath,
      season_number: s.seasonNumber,
      episodes: s.episodes?.map((ep: any) => ({
        air_date: ep.airDate,
        episode_number: ep.episodeNumber,
        id: ep.id,
        name: ep.name,
        overview: ep.overview,
        production_code: '',
        runtime: ep.runtime,
        season_number: ep.seasonNumber,
        show_id: 0,
        still_path: ep.stillPath,
        vote_average: ep.voteAverage,
        vote_count: ep.voteCount,
      })) || [],
    })) || [],
    spoken_languages: [],
    status: tvShow.status,
    tagline: '',
    type: '',
    vote_average: tvShow.voteAverage,
    vote_count: tvShow.voteCount,
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
  })
}
