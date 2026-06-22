const TMDB_BASE = 'https://api.themoviedb.org/3'
const API_KEY = process.env.TMDB_API_KEY!

async function tmdbRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function searchMovie(query: string, page = 1) {
  return tmdbRequest<{ results: Array<{
    id: number
    title: string
    original_title: string
    overview: string
    poster_path: string | null
    backdrop_path: string | null
    release_date: string | null
    vote_average: number
    vote_count: number
    genre_ids: number[]
  }> }>('/search/movie', { query, page: page.toString() })
}

export async function searchTv(query: string, page = 1) {
  return tmdbRequest<{ results: Array<{
    id: number
    name: string
    original_name: string
    overview: string
    poster_path: string | null
    backdrop_path: string | null
    first_air_date: string | null
    vote_average: number
    vote_count: number
    genre_ids: number[]
  }> }>('/search/tv', { query, page: page.toString() })
}

export interface CastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface CrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface Video {
  key: string
  name: string
  site: string
  type: string
  size: number
}

export interface MovieImage {
  file_path: string
  width: number
  type: string
}

export async function getMovieDetails(tmdbId: number) {
  return tmdbRequest<{
    id: number
    title: string
    original_title: string
    overview: string
    poster_path: string | null
    backdrop_path: string | null
    release_date: string | null
    runtime: number
    vote_average: number
    vote_count: number
    genres: Array<{ id: number; name: string }>
    production_companies: Array<{ id: number; logo_path: string | null; name: string; origin_country: string }>
    spoken_languages: Array<{ english_name: string; iso_639_1: string; name: string }>
    status: string
    tagline: string
    imdb_id: string | null
    belongs_to_collection: { id: number; name: string } | null
    credits: {
      cast: Array<{ id: number; name: string; character: string; profile_path: string | null; order: number }>
      crew: Array<{ id: number; name: string; job: string; department: string; profile_path: string | null }>
    }
    videos: { results: Array<{ key: string; name: string; site: string; type: string; size: number }> }
  }>(`/movie/${tmdbId}`, { append_to_response: 'credits,videos' })
}

export function extractMovieData(data: Awaited<ReturnType<typeof getMovieDetails>>) {
  const cast = data.credits?.cast?.slice(0, 20).map(c => ({
    id: c.id, name: c.name, character: c.character, profilePath: c.profile_path, order: c.order,
  })) || null
  const crew = data.credits?.crew?.filter(m => ['Director', 'Screenplay', 'Story', 'Producer'].includes(m.job)).map(m => ({
    id: m.id, name: m.name, job: m.job, department: m.department, profilePath: m.profile_path,
  })) || null
  const videos = data.videos?.results?.map(v => ({
    key: v.key, name: v.name, site: v.site, type: v.type, size: v.size,
  })) || null

  return {
    tmdbId: data.id,
    title: data.title,
    originalTitle: data.original_title,
    overview: data.overview,
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    releaseDate: data.release_date ? new Date(data.release_date) : null,
    runtime: data.runtime,
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
    genres: data.genres,
    productionCompanies: data.production_companies,
    spokenLanguages: data.spoken_languages,
    status: data.status,
    tagline: data.tagline,
    imdbId: data.imdb_id,
    cast,
    crew,
    videos,
  }
}

export async function getTvSeasons(tmdbId: number) {
  return tmdbRequest<{
    seasons: Array<{
      id: number
      name: string
      season_number: number
      episode_count: number
      overview: string
      poster_path: string | null
      air_date: string | null
    }>
  }>(`/tv/${tmdbId}`)
}

export async function getTvSeasonEpisodes(tmdbId: number, seasonNumber: number) {
  return tmdbRequest<{
    episodes: Array<{
      id: number
      name: string
      overview: string
      still_path: string | null
      episode_number: number
      season_number: number
      air_date: string | null
      runtime: number | null
      vote_average: number | null
      vote_count: number
    }>
  }>(`/tv/${tmdbId}/season/${seasonNumber}`)
}

export async function getTvDetails(tmdbId: number) {
  return tmdbRequest<{
    id: number
    name: string
    original_name: string
    overview: string
    poster_path: string | null
    backdrop_path: string | null
    first_air_date: string | null
    vote_average: number
    vote_count: number
    genres: Array<{ id: number; name: string }>
    status: string
    number_of_seasons: number
    number_of_episodes: number
    origin_country: string[]
    spoken_languages: Array<{ english_name: string; iso_639_1: string; name: string }>
    credits: {
      cast: Array<{ id: number; name: string; character: string; profile_path: string | null; order: number }>
      crew: Array<{ id: number; name: string; job: string; department: string; profile_path: string | null }>
    }
    videos: { results: Array<{ key: string; name: string; site: string; type: string; size: number }> }
  }>(`/tv/${tmdbId}`, { append_to_response: 'credits,videos' })
}

export async function extractTvDataFull(data: Awaited<ReturnType<typeof getTvDetails>>, tmdbId: number) {
  const cast = data.credits?.cast?.slice(0, 20).map(c => ({
    id: c.id, name: c.name, character: c.character, profilePath: c.profile_path, order: c.order,
  })) || null
  const crew = data.credits?.crew?.filter(m => ['Director', 'Creator', 'Writer', 'Executive Producer'].includes(m.job)).map(m => ({
    id: m.id, name: m.name, job: m.job, department: m.department, profilePath: m.profile_path,
  })) || null
  const videos = data.videos?.results?.map(v => ({
    key: v.key, name: v.name, site: v.site, type: v.type, size: v.size,
  })) || null

  // Fetch seasons with episodes in chunks to respect rate limits
  let seasons: any[] = []
  try {
    const seasonsData = await getTvSeasons(tmdbId)
    const chunkSize = 3
    for (let i = 0; i < seasonsData.seasons.length; i += chunkSize) {
      const chunk = seasonsData.seasons.slice(i, i + chunkSize)
      const results = await Promise.all(chunk.map(async (season) => {
        let episodes: any[] = []
        try {
          const eps = await getTvSeasonEpisodes(tmdbId, season.season_number)
          episodes = eps.episodes.map(ep => ({
            id: ep.id, name: ep.name, overview: ep.overview, stillPath: ep.still_path,
            episodeNumber: ep.episode_number, seasonNumber: ep.season_number,
            airDate: ep.air_date, runtime: ep.runtime, voteAverage: ep.vote_average, voteCount: ep.vote_count,
          }))
        } catch { /* skip episodes on error */ }
        return {
          id: season.id, name: season.name, seasonNumber: season.season_number,
          episodeCount: season.episode_count, overview: season.overview,
          posterPath: season.poster_path, airDate: season.air_date, episodes,
        }
      }))
      seasons.push(...results)
    }
  } catch { /* skip seasons on error */ }

  return {
    tmdbId: data.id,
    name: data.name,
    originalName: data.original_name,
    overview: data.overview,
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    firstAirDate: data.first_air_date ? new Date(data.first_air_date) : null,
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
    genres: data.genres,
    status: data.status,
    numberOfSeasons: data.number_of_seasons,
    numberOfEpisodes: data.number_of_episodes,
    originCountry: data.origin_country,
    spokenLanguage: data.spoken_languages?.[0]?.iso_639_1 || null,
    cast,
    crew,
    videos,
    seasons,
  }
}

export function extractTvData(data: Awaited<ReturnType<typeof getTvDetails>>) {
  const cast = data.credits?.cast?.slice(0, 20).map(c => ({
    id: c.id, name: c.name, character: c.character, profilePath: c.profile_path, order: c.order,
  })) || null
  const crew = data.credits?.crew?.filter(m => ['Director', 'Creator', 'Writer', 'Executive Producer'].includes(m.job)).map(m => ({
    id: m.id, name: m.name, job: m.job, department: m.department, profilePath: m.profile_path,
  })) || null
  const videos = data.videos?.results?.map(v => ({
    key: v.key, name: v.name, site: v.site, type: v.type, size: v.size,
  })) || null

  return {
    tmdbId: data.id,
    name: data.name,
    originalName: data.original_name,
    overview: data.overview,
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    firstAirDate: data.first_air_date ? new Date(data.first_air_date) : null,
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
    genres: data.genres,
    status: data.status,
    numberOfSeasons: data.number_of_seasons,
    numberOfEpisodes: data.number_of_episodes,
    originCountry: data.origin_country,
    spokenLanguage: data.spoken_languages?.[0]?.iso_639_1 || null,
    cast,
    crew,
    videos,
    seasons: null,
  }
}

export async function getTrendingMovies(window: 'day' | 'week' = 'day') {
  return tmdbRequest<{ results: Array<{ id: number }> }>(`/trending/movie/${window}`)
}

export async function getTrendingTv(window: 'day' | 'week' = 'day') {
  return tmdbRequest<{ results: Array<{ id: number }> }>(`/trending/tv/${window}`)
}

export async function getTopRatedMovies(page = 1) {
  return tmdbRequest<{ results: Array<{ id: number }> }>('/movie/top_rated', { page: page.toString() })
}

export async function getTopRatedTv(page = 1) {
  return tmdbRequest<{ results: Array<{ id: number }> }>('/tv/top_rated', { page: page.toString() })
}

export function getPosterPath(path: string | null, size: 'w500' | 'w780' | 'original' = 'w500') {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}

export function getBackdropPath(path: string | null, size: 'w1280' | 'w780' = 'w780') {
  if (!path) return null
  return `https://image.tmdb.org/t/p/${size}${path}`
}
