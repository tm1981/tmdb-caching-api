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

  const originalWarn = console.warn
  console.warn = () => {}
  try {
    // A connection reset is retried once and then succeeds.
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      if (calls === 1) {
        throw new TypeError('fetch failed', { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) })
      }
      return new Response(JSON.stringify({ id: 1, title: 'Retried' }), { status: 200 })
    }
    assert.equal((await getMovieDetails(1)).title, 'Retried')
    assert.equal(calls, 2)

    // An unreachable TMDB becomes a clean 504 instead of an uncaught fetch error.
    globalThis.fetch = async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    }
    await assert.rejects(
      () => getMovieDetails(1),
      error => error instanceof TmdbApiError && error.status === 504,
    )
    const unreachable = await tmdbRawRequest('/movie/1', new URLSearchParams())
    assert.equal(unreachable.ok, false)
    assert.equal(unreachable.status, 504)
    assert.equal(unreachable.retryAfter, null)
  } finally {
    console.warn = originalWarn
  }
} finally {
  globalThis.fetch = originalFetch
}
