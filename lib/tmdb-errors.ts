import { NextResponse } from 'next/server'
import { TmdbApiError } from '@/lib/tmdb'

// Maps upstream failures to client-facing responses without leaking internal error details.
export function tmdbFetchErrorResponse(error: unknown, label: string) {
  const headers: Record<string, string> = { 'x-tmdb-cache': 'bypass' }

  if (error instanceof TmdbApiError) {
    if (error.status === 404) {
      return NextResponse.json({ error: `${label} not found on TMDB` }, { status: 404, headers })
    }
    if (error.status === 429) {
      return NextResponse.json(
        { error: `Failed to fetch ${label.toLowerCase()} from TMDB: rate limited` },
        { status: 429, headers: { ...headers, 'x-ratelimit-source': 'tmdb', 'retry-after': error.retryAfter || '60' } },
      )
    }
    if (error.status === 504) {
      return NextResponse.json({ error: `TMDB timed out fetching ${label.toLowerCase()}` }, { status: 504, headers })
    }
    return NextResponse.json(
      { error: `Failed to fetch ${label.toLowerCase()} from TMDB: upstream status ${error.status}` },
      { status: 502, headers },
    )
  }

  console.error(`Lazy sync of ${label.toLowerCase()} failed:`, error)
  return NextResponse.json({ error: `Failed to fetch ${label.toLowerCase()} from TMDB` }, { status: 502, headers })
}
