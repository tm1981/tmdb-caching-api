export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense } from 'react'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getTvShows } from '@/app/actions/db'
import { getPosterPath } from '@/lib/tmdb'
import { getCachedTmdb } from '@/lib/tmdb-cache'
import { formatRating } from '@/lib/utils'
import { Tv } from 'lucide-react'

type TmdbTvResult = {
  id: number
  name: string
  poster_path: string | null
  first_air_date: string | null
  vote_average: number | null
}

async function searchTmdbTv(query: string) {
  if (!query) return []
  const result = await getCachedTmdb<{ results: TmdbTvResult[] }>('/search/tv', {
    query,
    page: 1,
    language: 'en-US',
    include_adult: 'false',
  })
  return result.payload.results || []
}

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const search = params.q || ''
  const page = parseInt(params.page || '1')

  const { tvShows, total, totalPages } = await getTvShows(page, 20, search)
  const localIds = new Set(tvShows.map((show) => show.tmdbId))
  const tmdbResults = search
    ? (await searchTmdbTv(search)).filter((show) => !localIds.has(show.id))
    : []

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">TV Shows</h2>
      <Suspense>
        <div>
          <form action="/admin/tv" method="GET" className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Input
                type="search"
                placeholder="Search TV shows..."
                defaultValue={search}
                name="q"
              />
            </div>
          </form>

          <div className="text-sm text-muted-foreground mb-4">
            Showing {tvShows.length} of {total} TV shows
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Poster</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>TMDB ID</TableHead>
                <TableHead>First Air Date</TableHead>
                <TableHead>Seasons</TableHead>
                <TableHead>Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tvShows.map((show) => (
                <TableRow key={show.id}>
                  <TableCell>
                    <Link href={`/admin/tv/${show.tmdbId}`} className="group">
                      {show.posterPath ? (
                        <img
                          src={getPosterPath(show.posterPath, 'w500')!}
                          alt={show.name}
                          className="w-12 h-16 object-cover rounded group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-muted rounded flex items-center justify-center">
                          <Tv className="size-4 text-muted-foreground" />
                        </div>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium max-w-[300px] truncate">
                    <Link
                      href={`/admin/tv/${show.tmdbId}`}
                      className="text-primary hover:underline"
                    >
                      {show.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{show.tmdbId}</Badge>
                  </TableCell>
                  <TableCell>
                    {show.firstAirDate
                      ? new Date(show.firstAirDate).toLocaleDateString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell>{show.numberOfSeasons || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        show.voteAverage && show.voteAverage >= 7
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {formatRating(show.voteAverage)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {search && tmdbResults.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-3">More From TMDB</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-8 gap-4">
                {tmdbResults.slice(0, 16).map((show) => (
                  <Link key={show.id} href={`/admin/tv/${show.id}`} className="group">
                    <div className="aspect-[2/3] rounded-md bg-muted overflow-hidden mb-2">
                      {show.poster_path ? (
                        <img
                          src={getPosterPath(show.poster_path, 'w500')!}
                          alt={show.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Tv className="size-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{show.name}</p>
                    <p className="text-xs text-muted-foreground">{show.first_air_date?.slice(0, 4) || 'N/A'}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
                <a
                  key={i}
                  href={`/admin/tv?page=${i + 1}&q=${encodeURIComponent(search)}`}
                  className={`px-3 py-1 rounded-md text-sm ${
                    i + 1 === page
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      </Suspense>
    </div>
  )
}
