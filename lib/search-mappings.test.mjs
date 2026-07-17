import assert from 'node:assert/strict'

const {
  applyManualSearchMapping,
  isUnresolvedSearchPayload,
  manualSearchCacheKey,
  normalizeSearchQuery,
  parseManualSearchMapping,
} = await import('./search-mappings.ts')

const mapping = {
  query: 'סדרה מיוחדת',
  mediaType: 'tv',
  tmdbId: 123,
  item: { id: 123, media_type: 'tv', name: 'The Correct Show' },
}

assert.equal(normalizeSearchQuery('  SHOW   Ａ  '), 'show a')
assert.equal(
  manualSearchCacheKey(' סדרה מיוחדת '),
  '/search/manual?query=%D7%A1%D7%93%D7%A8%D7%94%20%D7%9E%D7%99%D7%95%D7%97%D7%93%D7%AA',
)
assert.deepEqual(parseManualSearchMapping(mapping), mapping)
assert.equal(isUnresolvedSearchPayload('/search/multi', { results: [{ media_type: 'person' }] }), true)
assert.equal(isUnresolvedSearchPayload('/search/tv', { results: [{ id: 1 }] }), false)
assert.deepEqual(
  applyManualSearchMapping({ page: 1, results: [], total_pages: 0, total_results: 0 }, mapping),
  {
    page: 1,
    results: [mapping.item],
    total_pages: 1,
    total_results: 1,
  },
)
assert.deepEqual(
  applyManualSearchMapping({ results: [], total_pages: 0, total_results: 0 }, mapping, 'tv'),
  {
    results: [{ id: 123, name: 'The Correct Show' }],
    total_pages: 1,
    total_results: 1,
  },
)
