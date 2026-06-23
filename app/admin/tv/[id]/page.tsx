export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getPosterPath, getBackdropPath, getTvDetails, extractTvDataFull } from '@/lib/tmdb'
import { getTmdbCacheInfo } from '@/lib/tmdb-cache'
import { formatRating, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RefreshButton } from '@/components/admin/refresh-button'
import {
  ArrowLeft,
  Star,
  Users,
  Languages,
  Calendar,
  Globe,
  Link as LinkIcon,
  Tv,
  Play,
  Clapperboard,
  MonitorPlay,
  User,
  LayoutGrid,
  ChevronDown,
  Clock,
} from 'lucide-react'

async function getTvShow(tmdbId: number) {
  const cached = await prisma.tvShow.findUnique({
    where: { tmdbId },
  })
  if (cached) return cached

  try {
    const data = await getTvDetails(tmdbId)
    const tvData = await extractTvDataFull(data, tmdbId)

    const show = await prisma.tvShow.upsert({
      where: { tmdbId: data.id },
      create: tvData,
      update: tvData,
    })

    await prisma.syncLog.create({
      data: {
        type: 'tv',
        tmdbId: data.id,
        status: 'success',
        detail: `Admin lazy-synced TV show: ${data.name}`,
      },
    })

    return show
  } catch {
    return null
  }
}

function RatingBadge({ voteAverage, voteCount }: { voteAverage: number | null; voteCount: number | null }) {
  if (!voteAverage) return <span className="text-muted-foreground">No rating</span>

  const color =
    voteAverage >= 7
      ? 'text-emerald-400'
      : voteAverage >= 5
      ? 'text-yellow-400'
      : 'text-red-400'

  return (
    <div className="flex items-center gap-2">
      <Star className={`size-6 fill-current ${color}`} />
      <span className={`text-4xl font-bold tracking-tight ${color}`}>
        {formatRating(voteAverage)}
      </span>
      <span className="text-muted-foreground">/ 10</span>
      {voteCount && (
        <span className="text-sm text-muted-foreground ml-2">
          ({voteCount.toLocaleString()} votes)
        </span>
      )}
    </div>
  )
}

function CastCard({ member }: { member: { id: number; name: string; character: string; profilePath: string | null; order: number } }) {
  return (
    <Link href={`/admin/people/${member.id}`} className="group flex-shrink-0 w-40">
      <div className="relative overflow-hidden rounded-lg bg-muted aspect-[2/3] mb-2 ring-1 ring-white/5 group-hover:ring-white/20 transition-all">
        {member.profilePath ? (
          <img
            src={getPosterPath(member.profilePath, 'w500')!}
            alt={member.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="size-10 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
      </div>
      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{member.name}</p>
      {member.character && (
        <p className="text-xs text-muted-foreground truncate">
          as {member.character}
        </p>
      )}
    </Link>
  )
}

function CrewCard({ member }: { member: { id: number; name: string; job: string; department: string; profilePath: string | null } }) {
  return (
    <Link href={`/admin/people/${member.id}`} className="group flex items-center gap-3 py-2">
      {member.profilePath ? (
        <img
          src={getPosterPath(member.profilePath, 'w500')!}
          alt={member.name}
          className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center ring-1 ring-white/10">
          <User className="size-4 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="text-sm font-medium group-hover:text-primary transition-colors">{member.name}</p>
        <p className="text-xs text-muted-foreground">{member.job}</p>
      </div>
    </Link>
  )
}

function EpisodeCard({ ep }: { ep: { id: number; name: string; overview: string; stillPath: string | null; episodeNumber: number; airDate: string | null; runtime: number | null; voteAverage: number | null } }) {
  return (
    <div className="flex gap-4 py-3 border-b border-white/5 last:border-0">
      <span className="flex-shrink-0 w-8 text-center text-muted-foreground font-mono text-sm">
        {ep.episodeNumber}
      </span>
      {ep.stillPath ? (
        <div className="flex-shrink-0 w-32 aspect-video rounded-md overflow-hidden bg-muted ring-1 ring-white/5">
          <img
            src={`https://image.tmdb.org/t/p/w300${ep.stillPath}`}
            alt={ep.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-32 aspect-video rounded-md bg-muted flex items-center justify-center">
          <MonitorPlay className="size-5 text-muted-foreground/50" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h5 className="text-sm font-medium truncate">{ep.name}</h5>
          <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
            {ep.airDate && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(ep.airDate)}
              </span>
            )}
            {ep.runtime && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {ep.runtime}m
              </span>
            )}
            {ep.voteAverage && (
              <span className="flex items-center gap-0.5">
                <Star className={`size-3 ${ep.voteAverage >= 7 ? 'text-emerald-400' : 'text-yellow-400'}`} />
                {ep.voteAverage.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        {ep.overview && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ep.overview}</p>
        )}
      </div>
    </div>
  )
}

export default async function TvDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tmdbId = parseInt(id)

  if (isNaN(tmdbId)) {
    notFound()
  }

  const show = await getTvShow(tmdbId)

  if (!show) {
    notFound()
  }

  const rawCache = await getTmdbCacheInfo(`/tv/${tmdbId}`, {
    append_to_response: 'credits,videos',
    language: 'en-US',
  })

  const backdropUrl = getBackdropPath(show.backdropPath, 'w1280')
  const posterUrl = getPosterPath(show.posterPath, 'w780')
  const genres = show.genres as Array<{ id: number; name: string }> | null
  const spokenLanguage = show.spokenLanguage
  const cast = show.cast as Array<{ id: number; name: string; character: string; profilePath: string | null; order: number }> | null
  const crew = show.crew as Array<{ id: number; name: string; job: string; department: string; profilePath: string | null }> | null
  const videos = show.videos as Array<{ key: string; name: string; site: string; type: string; size: number }> | null
  const seasons = show.seasons as Array<{
    id: number; name: string; seasonNumber: number; episodeCount: number; overview: string;
    posterPath: string | null; airDate: string | null;
    episodes: Array<{
      id: number; name: string; overview: string; stillPath: string | null;
      episodeNumber: number; airDate: string | null; runtime: number | null;
      voteAverage: number | null; voteCount: number;
    }>;
  }> | null
  const originCountry = show.originCountry as string[] | null

  const trailer = videos?.find(v => v.type === 'Trailer' && v.site === 'YouTube') ||
                  videos?.find(v => v.type === 'Teaser' && v.site === 'YouTube') ||
                  videos?.find(v => v.site === 'YouTube')
  const creators = crew?.filter(m => m.job === 'Creator') || []
  const directors = crew?.filter(m => m.job === 'Director') || []

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Backdrop */}
      {backdropUrl ? (
        <div className="relative h-[40vh] min-h-[400px] w-full overflow-hidden">
          <img
            src={backdropUrl}
            alt={show.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
          <div className="absolute top-6 left-6 z-10">
            <Link
              href="/admin/tv"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-sm text-white/80 hover:text-white hover:bg-black/60 transition-colors"
            >
              <ArrowLeft className="size-3" />
              Back to TV shows
            </Link>
          </div>
        </div>
      ) : (
        <div className="h-64 bg-gradient-to-br from-gray-900 to-gray-800 relative">
          <div className="absolute top-6 left-6 z-10">
            <Link
              href="/admin/tv"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-sm text-white/80 hover:text-white hover:bg-black/60 transition-colors"
            >
              <ArrowLeft className="size-3" />
              Back to TV shows
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 -mt-32 relative z-10">
        <div className="flex gap-10">
          {/* Poster */}
          <div className="flex-shrink-0 w-72">
            {posterUrl ? (
              <div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group">
                <img
                  src={posterUrl}
                  alt={show.name}
                  className="w-full aspect-[2/3] object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
              </div>
            ) : (
              <div className="w-full aspect-[2/3] rounded-xl bg-muted/50 flex items-center justify-center shadow-2xl ring-1 ring-white/10">
                <Tv className="size-16 text-muted-foreground/50" />
              </div>
            )}
          </div>

          {/* Title & Info */}
          <div className="flex-1 pt-8 pb-4">
            <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
              {show.name}
            </h1>
            {show.originalName !== show.name && (
              <p className="text-lg text-muted-foreground mt-1">
                {show.originalName}
              </p>
            )}

            {show.status && (
              <div className="mt-2">
                <Badge variant="secondary" className="capitalize px-3 py-1 text-sm">
                  {show.status}
                </Badge>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-6 mt-6">
              <RatingBadge
                voteAverage={show.voteAverage}
                voteCount={show.voteCount}
              />

              <Separator orientation="vertical" className="h-8 hidden sm:block" />

              <div className="flex items-center gap-5 text-sm">
                {show.firstAirDate && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-4" />
                    {formatDate(show.firstAirDate)}
                  </span>
                )}
                {show.numberOfSeasons && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <LayoutGrid className="size-4" />
                    {show.numberOfSeasons} Season{show.numberOfSeasons > 1 ? 's' : ''}
                  </span>
                )}
                {show.numberOfEpisodes && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MonitorPlay className="size-4" />
                    {show.numberOfEpisodes} Episodes
                  </span>
                )}
              </div>
            </div>

            {/* Genres */}
            {genres && genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
                {genres.map((genre) => (
                  <Badge key={genre.id} variant="outline" className="px-3 py-1 text-sm">
                    {genre.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Trailer Watch Button */}
            <div className="mt-6 flex flex-wrap gap-2">
              <RefreshButton type="tv" id={show.tmdbId} />
              <Link
                href={`/admin/tmdb/tv/${show.tmdbId}?append_to_response=credits,videos&language=en-US`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-background shadow-xs text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <LinkIcon className="size-4" />
                View Raw TMDB
              </Link>
              {trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                >
                  <Play className="size-5 fill-current" />
                  Watch Trailer
                </a>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-10" />

        {/* Overview */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Tv className="size-5" />
            Overview
          </h2>
          <p className="text-muted-foreground leading-relaxed text-lg max-w-4xl">
            {show.overview || 'No overview available.'}
          </p>
        </div>

        {/* Trailer Embedded */}
        {trailer && (
          <>
            <Separator className="my-10" />
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <MonitorPlay className="size-5" />
                Trailer
              </h2>
              <div className="relative w-full max-w-4xl aspect-video rounded-xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10">
                <iframe
                  src={`https://www.youtube.com/embed/${trailer.key}`}
                  title={`Trailer for ${show.name}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">{trailer.name}</p>
            </div>
          </>
        )}

        {/* Cast */}
        {cast && cast.length > 0 && (
          <>
            <Separator className="my-10" />
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Users className="size-5" />
                Top Cast
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                {cast.map((member) => (
                  <CastCard key={member.id} member={member} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Crew */}
        {crew && crew.length > 0 && (
          <>
            <Separator className="my-10" />
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Clapperboard className="size-5" />
                Key Crew
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 max-w-4xl">
                {creators.map((member, i) => (
                  <CrewCard key={`${member.id}-${i}`} member={member} />
                ))}
                {directors.map((member, i) => (
                  <CrewCard key={`${member.id}-${i}`} member={member} />
                ))}
                {crew.filter(m => m.job === 'Executive Producer').map((member, i) => (
                  <CrewCard key={`${member.id}-${i}`} member={member} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Seasons & Episodes */}
        {seasons && seasons.length > 0 && (
          <>
            <Separator className="my-10" />
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6">Episodes</h2>
              <div className="space-y-4">
                {seasons.map((season) => (
                  <details key={season.id} className="group bg-card border border-white/5 rounded-lg overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5 transition-colors">
                      <ChevronDown className="size-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                      {season.posterPath ? (
                        <img
                          src={getPosterPath(season.posterPath, 'w500')!}
                          alt={season.name}
                          className="w-16 h-20 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-20 bg-muted rounded flex items-center justify-center">
                          <LayoutGrid className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium">{season.name}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          <span>{season.episodeCount} Episodes</span>
                          {season.airDate && <span>{formatDate(season.airDate)}</span>}
                        </div>
                      </div>
                    </summary>
                    <div className="px-4 pb-4">
                      {season.overview && (
                        <p className="text-sm text-muted-foreground pb-4">{season.overview}</p>
                      )}
                      {season.episodes && season.episodes.length > 0 ? (
                        <div className="divide-y divide-white/5">
                          {season.episodes.map((ep) => (
                            <EpisodeCard key={ep.id} ep={ep} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">No episode details available.</p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Detail Cards */}
        <Separator className="my-10" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                <Globe className="size-3" />
                Origin Country
              </h3>
              {originCountry && originCountry.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {originCountry.map((country) => (
                    <Badge key={country} variant="outline">{country}</Badge>
                  ))}
                </div>
              )}

              <div className="mt-5">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                  <Languages className="size-3" />
                  Spoken Language
                </h3>
                {spokenLanguage ? (
                  <Badge variant="outline">{spokenLanguage}</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">N/A</span>
                )}
              </div>

              <div className="mt-5">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                  <LinkIcon className="size-3" />
                  External IDs
                </h3>
                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">TMDB ID</span>
                    <span className="font-mono">{show.tmdbId}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Series Info */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                Series Info
              </h3>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Seasons</span>
                  <span className="font-medium">{show.numberOfSeasons || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Episodes</span>
                  <span className="font-medium">{show.numberOfEpisodes?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="secondary" className="capitalize">{show.status || 'N/A'}</Badge>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">First Aired</span>
                  <span className="font-medium">{show.firstAirDate ? formatDate(show.firstAirDate) : 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cached Info */}
        <div className="text-xs text-muted-foreground pb-12 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Cached on {formatDate(show.createdAt)}
          {show.updatedAt && show.updatedAt !== show.createdAt && (
            <> &middot; Updated {formatDate(show.updatedAt)}</>
          )}
          <> &middot; Raw TMDB cache {rawCache ? `updated ${formatDate(rawCache.updatedAt)}` : 'not cached'}</>
        </div>
      </div>
    </div>
  )
}
