import assert from 'node:assert/strict'
import test from 'node:test'
import { isCacheStale, privateCacheControl, tmdbCacheTtlMs } from './cache-ttl.ts'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

test('TMDB cache TTL follows how quickly each endpoint changes', () => {
  assert.equal(tmdbCacheTtlMs('/trending/movie/day'), HOUR)
  assert.equal(tmdbCacheTtlMs('/movie/latest'), HOUR)
  assert.equal(tmdbCacheTtlMs('/discover/tv'), 6 * HOUR)
  assert.equal(tmdbCacheTtlMs('/movie/popular'), 6 * HOUR)
  assert.equal(tmdbCacheTtlMs('/tv/on_the_air'), 6 * HOUR)
  assert.equal(tmdbCacheTtlMs('/search/multi'), DAY)
  assert.equal(tmdbCacheTtlMs('/find/tt0111161'), DAY)
  assert.equal(tmdbCacheTtlMs('/configuration'), 7 * DAY)
  assert.equal(tmdbCacheTtlMs('/genre/movie/list'), 7 * DAY)
  assert.equal(tmdbCacheTtlMs('/movie/278'), 3 * DAY)
  assert.equal(tmdbCacheTtlMs('/tv/1399/season/1'), 3 * DAY)
  assert.equal(tmdbCacheTtlMs('/person/287'), 3 * DAY)
})

test('rows become stale once their age reaches the TTL', () => {
  const now = Date.UTC(2026, 0, 2)
  assert.equal(isCacheStale(new Date(now - HOUR + 1), HOUR, now), false)
  assert.equal(isCacheStale(new Date(now - HOUR), HOUR, now), true)
})

test('client cache lifetime is the remaining freshness, clamped to 1 minute..1 hour', () => {
  const now = Date.UTC(2026, 0, 2)
  assert.equal(privateCacheControl(DAY), 'private, max-age=3600')
  assert.equal(privateCacheControl(HOUR, new Date(now - 50 * 60 * 1000), now), 'private, max-age=600')
  assert.equal(privateCacheControl(HOUR, new Date(now - 2 * HOUR), now), 'private, max-age=60')
})
