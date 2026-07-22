import assert from 'node:assert/strict'

const {
  applyManualSearchMapping,
  manualSearchMappingApplies,
  isUnresolvedSearchPayload,
  manualSearchCacheKey,
  normalizeSearchQuery,
  parseManualSearchMapping,
  tmdbSearchResponseHeaders,
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

assert.equal(manualSearchMappingApplies(mapping, 'tv'), true)
assert.equal(manualSearchMappingApplies(mapping, 'movie'), false)
assert.equal(manualSearchMappingApplies(null, 'movie'), false)
assert.deepEqual(tmdbSearchResponseHeaders('hit', mapping, 'tv'), {
  'x-tmdb-cache': 'hit',
  'x-tmdb-search-mapped': 'true',
})
assert.deepEqual(tmdbSearchResponseHeaders('miss', mapping, 'tv'), {
  'x-tmdb-cache': 'miss',
  'x-tmdb-search-mapped': 'true',
})
assert.deepEqual(tmdbSearchResponseHeaders('hit', mapping, 'movie'), {
  'x-tmdb-cache': 'hit',
})
assert.deepEqual(
  applyManualSearchMapping({ results: [], total_pages: 0, total_results: 0 }, mapping, 'tv'),
  {
    results: [{ id: 123, name: 'The Correct Show' }],
    total_pages: 1,
    total_results: 1,
  },
)
