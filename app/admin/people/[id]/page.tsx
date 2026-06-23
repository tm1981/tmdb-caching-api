export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPosterPath } from '@/lib/tmdb'
import { getCachedTmdb } from '@/lib/tmdb-cache'
import { formatDate, formatRating } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { BackButton } from '@/components/admin/back-button'
import { RefreshButton } from '@/components/admin/refresh-button'
import {
  Calendar,
  Film,
  Globe,
  ImageIcon,
  Link as LinkIcon,
  MapPin,
  Star,
  Tv,
  User,
} from 'lucide-react'

type Credit = {
  id: number
  media_type?: 'movie' | 'tv'
  title?: string
  name?: string
  poster_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  popularity?: number
  character?: string
  job?: string
}

type PersonPayload = {
  id: number
  name: string
  biography: string | null
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  known_for_department: string | null
  profile_path: string | null
  homepage: string | null
  imdb_id: string | null
  also_known_as?: string[]
  combined_credits?: {
    cast?: Credit[]
    crew?: Credit[]
  }
  images?: {
    profiles?: Array<{ file_path: string; width: number; height: number }>
  }
  external_ids?: {
    imdb_id?: string | null
    wikidata_id?: string | null
    instagram_id?: string | null
    twitter_id?: string | null
    facebook_id?: string | null
  }
}

async function getCachedPerson(id: number) {
  return getCachedTmdb<PersonPayload>(`/person/${id}`, {
    append_to_response: 'combined_credits,images,external_ids',
    language: 'en-US',
  })
}

function CreditCard({ credit }: { credit: Credit }) {
  const title = credit.title || credit.name || 'Untitled'
  const date = credit.release_date || credit.first_air_date
  const mediaType = credit.media_type || (credit.title ? 'movie' : 'tv')
  const href = mediaType === 'movie' ? `/admin/movies/${credit.id}` : `/admin/tv/${credit.id}`

  return (
    <Link href={href} className="group flex-shrink-0 w-36">
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted ring-1 ring-white/5 mb-2 group-hover:ring-white/20 transition-all">
        {credit.poster_path ? (
          <img
            src={getPosterPath(credit.poster_path, 'w500')!}
            alt={title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            {mediaType === 'movie' ? (
              <Film className="size-8 text-muted-foreground/50" />
            ) : (
              <Tv className="size-8 text-muted-foreground/50" />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 mb-1">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {mediaType}
        </Badge>
        {!!credit.vote_average && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Star className="size-3 text-yellow-400" />
            {formatRating(credit.vote_average)}
          </span>
        )}
      </div>
      <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{title}</p>
      {(credit.character || credit.job) && (
        <p className="text-xs text-muted-foreground truncate">{credit.character || credit.job}</p>
      )}
      {date && <p className="text-xs text-muted-foreground">{date.slice(0, 4)}</p>}
    </Link>
  )
}

function CreditRail({ title, credits }: { title: string; credits: Credit[] }) {
  if (!credits.length) return null

  return (
    <section>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {credits.slice(0, 18).map((credit, index) => (
          <CreditCard key={`${credit.media_type}-${credit.id}-${index}`} credit={credit} />
        ))}
      </div>
    </section>
  )
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const personId = parseInt(id)

  if (isNaN(personId)) notFound()

  const personResult = await getCachedPerson(personId)
  const person = personResult.payload
  if (!person) notFound()

  const profileUrl = getPosterPath(person.profile_path, 'w780')
  const castCredits = (person.combined_credits?.cast || []).sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
  const crewCredits = (person.combined_credits?.crew || []).sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
  const movieActing = castCredits.filter((credit) => (credit.media_type || 'movie') === 'movie')
  const tvActing = castCredits.filter((credit) => credit.media_type === 'tv')
  const movieCrew = crewCredits.filter((credit) => (credit.media_type || 'movie') === 'movie')
  const tvCrew = crewCredits.filter((credit) => credit.media_type === 'tv')
  const profiles = person.images?.profiles?.slice(0, 8) || []
  const external = person.external_ids || {}
  const imdbId = external.imdb_id || person.imdb_id

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <BackButton />

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="w-full max-w-72 flex-shrink-0">
          {profileUrl ? (
            <img
              src={profileUrl}
              alt={person.name}
              className="w-full rounded-xl shadow-2xl ring-1 ring-white/10"
            />
          ) : (
            <div className="aspect-[2/3] rounded-xl bg-muted flex items-center justify-center">
              <User className="size-16 text-muted-foreground/50" />
            </div>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-5xl font-extrabold tracking-tight">{person.name}</h1>
          {person.known_for_department && (
            <Badge variant="secondary" className="mt-3">
              {person.known_for_department}
            </Badge>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <RefreshButton type="person" id={person.id} />
            <Link
              href={`/admin/tmdb/person/${person.id}?append_to_response=combined_credits,images,external_ids&language=en-US`}
              className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
            >
              <LinkIcon className="size-4" />
              View Raw TMDB
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {person.birthday && (
              <Card>
                <CardContent className="pt-6 flex items-center gap-3">
                  <Calendar className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Born</p>
                    <p className="text-sm font-medium">{formatDate(person.birthday)}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {person.place_of_birth && (
              <Card>
                <CardContent className="pt-6 flex items-center gap-3">
                  <MapPin className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Place</p>
                    <p className="text-sm font-medium">{person.place_of_birth}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {imdbId && (
              <Card>
                <CardContent className="pt-6 flex items-center gap-3">
                  <LinkIcon className="size-5 text-muted-foreground" />
                  <a
                    href={`https://www.imdb.com/name/${imdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    IMDb Profile
                  </a>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator className="my-8" />

          <section>
            <h2 className="text-xl font-semibold mb-4">Biography</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {person.biography || 'No biography available.'}
            </p>
          </section>
        </div>
      </div>

      {(movieActing.length || tvActing.length || movieCrew.length || tvCrew.length) > 0 && (
        <>
          <Separator className="my-10" />
          <section className="space-y-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Globe className="size-5" />
              Credits
            </h2>
            <CreditRail title="Movie Acting" credits={movieActing} />
            <CreditRail title="TV Acting" credits={tvActing} />
            <CreditRail title="Movie Crew" credits={movieCrew} />
            <CreditRail title="TV Crew" credits={tvCrew} />
          </section>
        </>
      )}

      {profiles.length > 0 && (
        <>
          <Separator className="my-10" />
          <section className="pb-12">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <ImageIcon className="size-5" />
              Images
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {profiles.map((profile) => (
                <a
                  key={profile.file_path}
                  href={getPosterPath(profile.file_path, 'original')!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <img
                    src={getPosterPath(profile.file_path, 'w500')!}
                    alt={person.name}
                    className="aspect-[2/3] w-full object-cover rounded-lg ring-1 ring-white/10 group-hover:ring-white/30 transition-all"
                  />
                </a>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="text-xs text-muted-foreground pb-12 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Raw TMDB cache {personResult.updatedAt ? `updated ${formatDate(personResult.updatedAt)}` : 'not cached'}
      </div>
    </div>
  )
}
