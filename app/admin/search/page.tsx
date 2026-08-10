export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  deleteSearchMapping,
  dismissSearchCapture,
  getSearchFixes,
  restoreSearchCapture,
  saveSearchMapping,
  searchTmdbMappingCandidates,
} from '@/app/actions/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPosterPath } from '@/lib/tmdb'

const selectClassName = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function MappingFields({
  id,
  mediaType = 'tv',
  tmdbId,
}: {
  id: string
  mediaType?: 'movie' | 'tv'
  tmdbId?: number
}) {
  return (
    <>
      <select
        aria-label="Media type"
        className={selectClassName}
        defaultValue={mediaType}
        name="mediaType"
      >
        <option value="tv">TV show</option>
        <option value="movie">Movie</option>
      </select>
      <Input
        aria-label="TMDB ID"
        className="w-32"
        defaultValue={tmdbId}
        id={`${id}-tmdb-id`}
        min={1}
        name="tmdbId"
        placeholder="TMDB ID"
        required
        type="number"
      />
    </>
  )
}

function CaptureStats({
  firstSeen,
  lastSeen,
  occurrences,
}: {
  firstSeen: Date
  lastSeen: Date
  occurrences: number
}) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {occurrences.toLocaleString()} {occurrences === 1 ? 'search' : 'searches'} · first {firstSeen.toLocaleString()} · last {lastSeen.toLocaleString()}
    </p>
  )
}

type MappingCandidate = Awaited<ReturnType<typeof searchTmdbMappingCandidates>>[number]

function CandidateCard({ candidate, query }: { candidate: MappingCandidate; query: string }) {
  const year = candidate.date?.slice(0, 4) || 'Unknown year'
  return (
    <form action={saveSearchMapping} className="flex gap-3 rounded-md border p-3">
      {candidate.posterPath ? (
        <img
          alt=""
          className="h-24 w-16 shrink-0 rounded object-cover"
          src={getPosterPath(candidate.posterPath, 'w500')!}
        />
      ) : (
        <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
          No poster
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium" dir="auto">{candidate.title}</p>
          <Badge variant="secondary">{candidate.mediaType}</Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground" dir="auto">
          {candidate.originalTitle} · {year} · TMDB {candidate.tmdbId}
          {candidate.voteAverage === null ? '' : ` · ${candidate.voteAverage.toFixed(1)}/10`}
        </p>
        <input name="query" type="hidden" value={query} />
        <input name="mediaType" type="hidden" value={candidate.mediaType} />
        <input name="tmdbId" type="hidden" value={candidate.tmdbId} />
        <Button className="mt-auto" size="sm" type="submit">Use this result</Button>
      </div>
    </form>
  )
}

export default async function SearchFixesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string
    saved?: string
    deleted?: string
    dismissed?: string
    restored?: string
    lookup?: string
  }>
}) {
  const params = await searchParams
  const lookup = (params.lookup || '').trim().slice(0, 200)
  const [fixes, candidates] = await Promise.all([
    getSearchFixes(),
    lookup ? searchTmdbMappingCandidates(lookup) : Promise.resolve([]),
  ])

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Search Fixes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review failed provider searches, find the correct TMDB result, or dismiss known no-match queries.
        </p>
      </div>

      {params.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.saved ? (
        <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm" role="status">
          Search mapping saved.
        </p>
      ) : null}
      {params.deleted ? (
        <p className="rounded-md border p-3 text-sm" role="status">Search mapping deleted.</p>
      ) : null}
      {params.dismissed ? (
        <p className="rounded-md border p-3 text-sm" role="status">Search capture dismissed.</p>
      ) : null}
      {params.restored ? (
        <p className="rounded-md border p-3 text-sm" role="status">Search capture restored.</p>
      ) : null}

      <Card id="tmdb-picker">
        <CardHeader>
          <CardTitle>Find the correct TMDB result</CardTitle>
          <CardDescription>
            Search movies and TV together, preview the match, then map it with one click.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-2 sm:flex-row" method="get">
            <Input
              aria-label="Search TMDB"
              defaultValue={lookup}
              maxLength={200}
              name="lookup"
              placeholder="Provider search text"
              required
            />
            <Button type="submit">Search TMDB</Button>
            {lookup ? (
              <Button asChild variant="outline"><Link href="/admin/search">Clear</Link></Button>
            ) : null}
          </form>
          {lookup && candidates.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No movie or TV matches found. You can dismiss its capture below.
            </p>
          ) : null}
          {candidates.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {candidates.map(candidate => (
                <CandidateCard
                  candidate={candidate}
                  key={`${candidate.mediaType}:${candidate.tmdbId}`}
                  query={lookup}
                />
              ))}
            </div>
          ) : null}

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Or enter a TMDB ID manually</p>
            <form action={saveSearchMapping} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="new-search-query">Provider search text</Label>
                <Input
                  id="new-search-query"
                  maxLength={200}
                  name="query"
                  placeholder="e.g. Hebrew title [provider]"
                  required
                />
              </div>
              <MappingFields id="new-search" />
              <Button type="submit">Save mapping</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unresolved searches ({fixes.unresolved.length})</CardTitle>
          <CardDescription>
            Sorted by frequency, then most recently seen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fixes.unresolved.map((search, index) => (
            <form
              action={saveSearchMapping}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
              key={`${search.path}:${search.query}`}
            >
              <div className="min-w-0">
                <p className="break-words font-medium" dir="auto">{search.query}</p>
                <p className="mt-1 text-xs text-muted-foreground">{search.path}</p>
                <CaptureStats
                  firstSeen={search.firstSeen}
                  lastSeen={search.capturedAt}
                  occurrences={search.occurrences}
                />
              </div>
              <input name="query" type="hidden" value={search.query} />
              <input name="path" type="hidden" value={search.path} />
              <MappingFields id={`unresolved-${index}`} />
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/admin/search?lookup=${encodeURIComponent(search.query)}#tmdb-picker`}>Find match</Link>
                </Button>
                <Button type="submit">Resolve</Button>
                <Button formAction={dismissSearchCapture} formNoValidate type="submit" variant="outline">
                  Dismiss
                </Button>
              </div>
            </form>
          ))}
          {fixes.unresolved.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No unresolved searches.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dismissed captures ({fixes.dismissed.length})</CardTitle>
          <CardDescription>
            Known no-match searches stay hidden from unresolved results until restored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fixes.dismissed.map(search => (
            <form
              action={restoreSearchCapture}
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center"
              key={`${search.path}:${search.query}`}
            >
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium" dir="auto">{search.query}</p>
                <p className="mt-1 text-xs text-muted-foreground">{search.path}</p>
                <CaptureStats
                  firstSeen={search.firstSeen}
                  lastSeen={search.capturedAt}
                  occurrences={search.occurrences}
                />
              </div>
              <input name="query" type="hidden" value={search.query} />
              <input name="path" type="hidden" value={search.path} />
              <Button type="submit" variant="outline">Restore</Button>
            </form>
          ))}
          {fixes.dismissed.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No dismissed captures.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active mappings ({fixes.mappings.length})</CardTitle>
          <CardDescription>
            These results are placed first for matching normalized and TMDB mirror searches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fixes.mappings.map((mapping, index) => {
            const title = typeof mapping.item.title === 'string'
              ? mapping.item.title
              : typeof mapping.item.name === 'string'
                ? mapping.item.name
                : 'Unknown title'

            return (
              <form
                action={saveSearchMapping}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center"
                key={`${mapping.mediaType}:${mapping.query}`}
              >
                <div className="min-w-0">
                  <p className="break-words font-medium" dir="auto">{mapping.query}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {title} · updated {mapping.updatedAt.toLocaleString()}
                  </p>
                </div>
                <Badge className="w-fit" variant="secondary">{mapping.mediaType}</Badge>
                <input name="query" type="hidden" value={mapping.query} />
                <MappingFields
                  id={`mapping-${index}`}
                  mediaType={mapping.mediaType}
                  tmdbId={mapping.tmdbId}
                />
                <div className="flex gap-2">
                  <Button type="submit">Update</Button>
                  <Button formAction={deleteSearchMapping} type="submit" variant="outline">Delete</Button>
                </div>
              </form>
            )
          })}
          {fixes.mappings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No manual mappings yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
