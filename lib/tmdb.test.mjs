import assert from 'node:assert/strict'

const originalFetch = globalThis.fetch

try {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ status_message: 'Your request count is over the allowed limit.' }),
    {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'content-type': 'application/json', 'retry-after': '17' },
    },
  )

  const { getMovieDetails, tmdbRawRequest, TmdbApiError } = await import('./tmdb.ts')

  await assert.rejects(
    () => getMovieDetails(1),
    error => error instanceof TmdbApiError
      && error.status === 429
      && error.retryAfter === '17',
  )

  const raw = await tmdbRawRequest('/movie/1', new URLSearchParams())
  assert.equal(raw.ok, false)
  assert.equal(raw.status, 429)
  assert.equal(raw.retryAfter, '17')
} finally {
  globalThis.fetch = originalFetch
}
