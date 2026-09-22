export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  deleteSearchMapping,
  dismissSearchCapture,
  getSearchFixes,
  restoreSearchCapture,
  saveSearchMapping,
  searchTmdbMappingCandidates,
  type SearchFixSort,
  type SearchFixTab,
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
import { cn } from '@/lib/utils'
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

function CandidateCard({
  candidate,
  query,
  returnTab,
  returnPage,
  returnQ,
  returnSort,
  returnPageSize,
}: {
  candidate: MappingCandidate
  query: string
  returnTab?: string
  returnPage?: string
  returnQ?: string
  returnSort?: string
  returnPageSize?: string
}) {
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
        {returnTab ? <input name="returnTab" type="hidden" value={returnTab} /> : null}
        {returnPage ? <input name="returnPage" type="hidden" value={returnPage} /> : null}
        {returnQ ? <input name="returnQ" type="hidden" value={returnQ} /> : null}
        {returnSort ? <input name="returnSort" type="hidden" value={returnSort} /> : null}
        {returnPageSize ? <input name="returnPageSize" type="hidden" value={returnPageSize} /> : null}
        <Button className="mt-auto" size="sm" type="submit">Use this result</Button>
      </div>
    </form>
  )
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  buildUrl,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  buildUrl: (page: number) => string
}) {
  if (totalItems === 0) return null

  const from = Math.min((currentPage - 1) * pageSize + 1, totalItems)
  const to = Math.min(currentPage * pageSize, totalItems)

  const pages: number[] = []
  const maxButtons = 5
  let start = Math.max(1, currentPage - Math.floor(maxButtons / 2))
  const end = Math.min(totalPages, start + maxButtons - 1)
  if (end - start + 1 < maxButtons) {
    start = Math.max(1, end - maxButtons + 1)
  }
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2">
      <p className="text-xs text-muted-foreground">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {totalItems.toLocaleString()} items
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {currentPage > 1 ? (
            <>
              <Button asChild size="sm" variant="outline" className="h-8 px-2 text-xs">
                <Link href={buildUrl(1)}>First</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8 px-2 text-xs">
                <Link href={buildUrl(currentPage - 1)}>Prev</Link>
              </Button>
            </>
          ) : null}

          {pages.map(p => (
            <Button
              asChild
              key={p}
              size="sm"
              variant={p === currentPage ? 'default' : 'outline'}
              className="h-8 w-8 p-0 text-xs"
            >
              <Link href={buildUrl(p)}>{p}</Link>
            </Button>
          ))}

          {currentPage < totalPages ? (
            <>
              <Button asChild size="sm" variant="outline" className="h-8 px-2 text-xs">
                <Link href={buildUrl(currentPage + 1)}>Next</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8 px-2 text-xs">
                <Link href={buildUrl(totalPages)}>Last</Link>
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
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
    tab?: string
    q?: string
    page?: string
    pageSize?: string
    sort?: string
  }>
}) {
  const params = await searchParams
  const lookup = (params.lookup || '').trim().slice(0, 200)
  const tab: SearchFixTab = (params.tab === 'dismissed' || params.tab === 'mappings') ? params.tab : 'unresolved'
  const q = (params.q || '').trim()
  const page = Math.max(1, parseInt(params.page || '1') || 1)
  const pageSize = Math.max(10, Math.min(200, parseInt(params.pageSize || '50') || 50))
  const defaultSort: SearchFixSort = tab === 'unresolved' ? 'frequent' : 'recent'
  const sort: SearchFixSort = (['frequent', 'recent', 'oldest', 'query'].includes(params.sort || '')
    ? params.sort
    : defaultSort) as SearchFixSort

  const [fixes, candidates] = await Promise.all([
    getSearchFixes({ tab, q, page, pageSize, sort }),
    lookup ? searchTmdbMappingCandidates(lookup) : Promise.resolve([]),
  ])

  const buildUrl = (opts: { page?: number; tab?: SearchFixTab; q?: string; sort?: SearchFixSort; pageSize?: number }) => {
    const nextTab = opts.tab ?? tab
    const nextPage = opts.page ?? 1
    const nextQ = opts.q !== undefined ? opts.q : q
    const nextSort = opts.sort ?? sort
    const nextPageSize = opts.pageSize ?? pageSize

    const queryParams = new URLSearchParams()
    if (nextTab !== 'unresolved') queryParams.set('tab', nextTab)
    if (nextPage > 1) queryParams.set('page', String(nextPage))
    if (nextQ) queryParams.set('q', nextQ)
    if (nextSort !== (nextTab === 'unresolved' ? 'frequent' : 'recent')) queryParams.set('sort', nextSort)
    if (nextPageSize !== 50) queryParams.set('pageSize', String(nextPageSize))
    const s = queryParams.toString()
    return `/admin/search${s ? `?${s}` : ''}`
  }

  const buildLookupUrl = (lookupText: string) => {
    const queryParams = new URLSearchParams()
    queryParams.set('lookup', lookupText)
    if (tab !== 'unresolved') queryParams.set('tab', tab)
    if (fixes.page > 1) queryParams.set('page', String(fixes.page))
    if (q) queryParams.set('q', q)
    if (sort !== defaultSort) queryParams.set('sort', sort)
    if (pageSize !== 50) queryParams.set('pageSize', String(pageSize))
    return `/admin/search?${queryParams.toString()}#tmdb-picker`
  }

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
            {tab !== 'unresolved' ? <input name="tab" type="hidden" value={tab} /> : null}
            {fixes.page > 1 ? <input name="page" type="hidden" value={String(fixes.page)} /> : null}
            {q ? <input name="q" type="hidden" value={q} /> : null}
            {sort !== defaultSort ? <input name="sort" type="hidden" value={sort} /> : null}
            {pageSize !== 50 ? <input name="pageSize" type="hidden" value={String(pageSize)} /> : null}
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
              <Button asChild variant="outline">
                <Link href={buildUrl({ page: fixes.page })}>Clear</Link>
              </Button>
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
                  returnTab={tab}
                  returnPage={String(fixes.page)}
                  returnQ={q}
                  returnSort={sort}
                  returnPageSize={String(pageSize)}
                />
              ))}
            </div>
          ) : null}

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Or enter a TMDB ID manually</p>
            <form action={saveSearchMapping} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end">
              <input name="returnTab" type="hidden" value={tab} />
              <input name="returnPage" type="hidden" value={String(fixes.page)} />
              {q ? <input name="returnQ" type="hidden" value={q} /> : null}
              {sort !== defaultSort ? <input name="returnSort" type="hidden" value={sort} /> : null}
              {pageSize !== 50 ? <input name="returnPageSize" type="hidden" value={String(pageSize)} /> : null}
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

      {/* Tabs Navigation */}
      <div className="flex border-b border-border overflow-x-auto">
        <Link
          href={buildUrl({ tab: 'unresolved', page: 1 })}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
            tab === 'unresolved'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Unresolved searches
          <Badge variant={tab === 'unresolved' ? 'default' : 'secondary'} className="text-xs">
            {fixes.counts.unresolved.toLocaleString()}
          </Badge>
        </Link>
        <Link
          href={buildUrl({ tab: 'dismissed', page: 1 })}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
            tab === 'dismissed'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Dismissed captures
          <Badge variant={tab === 'dismissed' ? 'default' : 'secondary'} className="text-xs">
            {fixes.counts.dismissed.toLocaleString()}
          </Badge>
        </Link>
        <Link
          href={buildUrl({ tab: 'mappings', page: 1 })}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
            tab === 'mappings'
              ? 'border-primary text-foreground font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Active mappings
          <Badge variant={tab === 'mappings' ? 'default' : 'secondary'} className="text-xs">
            {fixes.counts.mappings.toLocaleString()}
          </Badge>
        </Link>
      </div>

      {/* Filter and sorting controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
        <form method="get" className="flex flex-wrap items-center gap-2 flex-1">
          <input name="tab" type="hidden" value={tab} />
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Input
              aria-label="Filter search terms"
              defaultValue={q}
              name="q"
              placeholder={`Filter ${tab === 'unresolved' ? 'unresolved' : tab === 'dismissed' ? 'dismissed' : 'active'} terms...`}
              className="h-9"
            />
          </div>
          <select aria-label="Sort order" className={selectClassName} defaultValue={sort} name="sort">
            <option value="frequent">Most frequent</option>
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
            <option value="query">Alphabetical (A-Z)</option>
          </select>
          <select aria-label="Page size" className={selectClassName} defaultValue={String(pageSize)} name="pageSize">
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
          <Button size="sm" type="submit" variant="secondary">Filter</Button>
          {q ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={buildUrl({ q: '', page: 1 })}>Clear</Link>
            </Button>
          ) : null}
        </form>
      </div>

      {/* Tab: Unresolved Searches */}
      {tab === 'unresolved' && (
        <Card>
          <CardHeader>
            <CardTitle>Unresolved searches ({fixes.counts.unresolved.toLocaleString()})</CardTitle>
            <CardDescription>
              Sorted by {sort === 'frequent' ? 'frequency, then most recently seen' : sort === 'recent' ? 'most recently seen' : sort === 'oldest' ? 'oldest seen first' : 'alphabetical order'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PaginationControls
              currentPage={fixes.page}
              totalPages={fixes.totalPages}
              totalItems={fixes.total}
              pageSize={fixes.pageSize}
              buildUrl={p => buildUrl({ page: p })}
            />

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
                <input name="returnTab" type="hidden" value={tab} />
                <input name="returnPage" type="hidden" value={String(fixes.page)} />
                {q ? <input name="returnQ" type="hidden" value={q} /> : null}
                {sort !== defaultSort ? <input name="returnSort" type="hidden" value={sort} /> : null}
                {pageSize !== 50 ? <input name="returnPageSize" type="hidden" value={String(pageSize)} /> : null}
                <MappingFields id={`unresolved-${index}`} />
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href={buildLookupUrl(search.query)}>Find match</Link>
                  </Button>
                  <Button type="submit">Resolve</Button>
                  <Button formAction={dismissSearchCapture} formNoValidate type="submit" variant="outline">
                    Dismiss
                  </Button>
                </div>
              </form>
            ))}

            {fixes.unresolved.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {q ? 'No unresolved searches matching the filter.' : 'No unresolved searches.'}
              </p>
            ) : null}

            <PaginationControls
              currentPage={fixes.page}
              totalPages={fixes.totalPages}
              totalItems={fixes.total}
              pageSize={fixes.pageSize}
              buildUrl={p => buildUrl({ page: p })}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab: Dismissed Captures */}
      {tab === 'dismissed' && (
        <Card>
          <CardHeader>
            <CardTitle>Dismissed captures ({fixes.counts.dismissed.toLocaleString()})</CardTitle>
            <CardDescription>
              Known no-match searches stay hidden from unresolved results until restored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PaginationControls
              currentPage={fixes.page}
              totalPages={fixes.totalPages}
              totalItems={fixes.total}
              pageSize={fixes.pageSize}
              buildUrl={p => buildUrl({ page: p })}
            />

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
                <input name="returnTab" type="hidden" value={tab} />
                <input name="returnPage" type="hidden" value={String(fixes.page)} />
                {q ? <input name="returnQ" type="hidden" value={q} /> : null}
                {sort !== defaultSort ? <input name="returnSort" type="hidden" value={sort} /> : null}
                {pageSize !== 50 ? <input name="returnPageSize" type="hidden" value={String(pageSize)} /> : null}
                <Button type="submit" variant="outline">Restore</Button>
              </form>
            ))}

            {fixes.dismissed.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {q ? 'No dismissed captures matching the filter.' : 'No dismissed captures.'}
              </p>
            ) : null}

            <PaginationControls
              currentPage={fixes.page}
              totalPages={fixes.totalPages}
              totalItems={fixes.total}
              pageSize={fixes.pageSize}
              buildUrl={p => buildUrl({ page: p })}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab: Active Mappings */}
      {tab === 'mappings' && (
        <Card>
          <CardHeader>
            <CardTitle>Active mappings ({fixes.counts.mappings.toLocaleString()})</CardTitle>
            <CardDescription>
              These results are placed first for matching normalized and TMDB mirror searches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <PaginationControls
              currentPage={fixes.page}
              totalPages={fixes.totalPages}
              totalItems={fixes.total}
              pageSize={fixes.pageSize}
              buildUrl={p => buildUrl({ page: p })}
            />

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
                  <input name="returnTab" type="hidden" value={tab} />
                  <input name="returnPage" type="hidden" value={String(fixes.page)} />
                  {q ? <input name="returnQ" type="hidden" value={q} /> : null}
                  {sort !== defaultSort ? <input name="returnSort" type="hidden" value={sort} /> : null}
                  {pageSize !== 50 ? <input name="returnPageSize" type="hidden" value={String(pageSize)} /> : null}
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
              <p className="py-6 text-center text-sm text-muted-foreground">
                {q ? 'No manual mappings matching the filter.' : 'No manual mappings yet.'}
              </p>
            ) : null}

            <PaginationControls
              currentPage={fixes.page}
              totalPages={fixes.totalPages}
              totalItems={fixes.total}
              pageSize={fixes.pageSize}
              buildUrl={p => buildUrl({ page: p })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
