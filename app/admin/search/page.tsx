export const dynamic = 'force-dynamic'

import {
  deleteSearchMapping,
  getSearchFixes,
  saveSearchMapping,
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

export default async function SearchFixesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>
}) {
  const [params, fixes] = await Promise.all([searchParams, getSearchFixes()])

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Search Fixes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Empty movie and TV searches appear here. Map the exact provider text to the correct TMDB item.
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
        <p className="rounded-md border p-3 text-sm" role="status">
          Search mapping deleted.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add a mapping</CardTitle>
          <CardDescription>
            Use this when TMDB returned unrelated results, so the search was not captured as empty.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unresolved searches</CardTitle>
          <CardDescription>
            Captured automatically when TMDB returned no movie or TV result.
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {search.path} · captured {search.capturedAt.toLocaleString()}
                </p>
              </div>
              <input name="query" type="hidden" value={search.query} />
              <MappingFields id={`unresolved-${index}`} />
              <Button type="submit">Resolve</Button>
            </form>
          ))}
          {fixes.unresolved.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No unresolved searches.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active mappings</CardTitle>
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
