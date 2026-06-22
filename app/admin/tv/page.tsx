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
import { formatRating } from '@/lib/utils'
import { Tv } from 'lucide-react'

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const search = params.q || ''
  const page = parseInt(params.page || '1')

  const { tvShows, total, totalPages } = await getTvShows(page, 20, search)

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
