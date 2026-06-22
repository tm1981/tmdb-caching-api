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
import { getMovies } from '@/app/actions/db'
import { getPosterPath } from '@/lib/tmdb'
import { formatRating } from '@/lib/utils'
import { Film } from 'lucide-react'

async function MovieTableContent({ search, page }: { search: string; page: number }) {
  const { movies, total, totalPages } = await getMovies(page, 20, search)

  return (
    <>
      <div className="text-sm text-muted-foreground mb-4">
        Showing {movies.length} of {total} movies
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Poster</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>TMDB ID</TableHead>
            <TableHead>Release</TableHead>
            <TableHead>Rating</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movies.map((movie) => (
            <TableRow key={movie.id}>
              <TableCell>
                <Link href={`/admin/movies/${movie.tmdbId}`} className="group">
                  {movie.posterPath ? (
                    <img
                      src={getPosterPath(movie.posterPath, 'w500')!}
                      alt={movie.title}
                      className="w-12 h-16 object-cover rounded group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-muted rounded flex items-center justify-center">
                      <Film className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </Link>
              </TableCell>
              <TableCell className="font-medium max-w-[300px] truncate">
                <Link
                  href={`/admin/movies/${movie.tmdbId}`}
                  className="text-primary hover:underline"
                >
                  {movie.title}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{movie.tmdbId}</Badge>
              </TableCell>
              <TableCell>
                {movie.releaseDate
                  ? new Date(movie.releaseDate).toLocaleDateString()
                  : 'N/A'}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    movie.voteAverage && movie.voteAverage >= 7
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {formatRating(movie.voteAverage)}
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
              href={`/admin/movies?page=${i + 1}&q=${encodeURIComponent(search)}`}
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
    </>
  )
}

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const search = params.q || ''
  const page = parseInt(params.page || '1')

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Movies</h2>
      <Suspense>
        <div>
          <form action="/admin/movies" method="GET" className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Input
                type="search"
                placeholder="Search movies..."
                defaultValue={search}
                name="q"
              />
            </div>
          </form>
          <MovieTableContent search={search} page={page} />
        </div>
      </Suspense>
    </div>
  )
}
