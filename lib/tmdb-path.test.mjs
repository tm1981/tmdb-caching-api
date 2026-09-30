import assert from 'node:assert/strict'

const { tmdbEndpoint } = await import('./tmdb-path.ts')

assert.deepEqual(tmdbEndpoint(['movie', '550']), { segments: ['movie', '550'], endpoint: '/movie/550' })
assert.equal(tmdbEndpoint(['tv', '1399', 'season', '1', 'episode', '2'])?.endpoint, '/tv/1399/season/1/episode/2')
assert.equal(tmdbEndpoint(['find', 'tt0137523'])?.endpoint, '/find/tt0137523')
assert.equal(tmdbEndpoint(['find', 'some.page'])?.endpoint, '/find/some.page')
assert.equal(tmdbEndpoint(['movie', '', '550'])?.endpoint, '/movie/550')

assert.equal(tmdbEndpoint([]), null)
assert.equal(tmdbEndpoint(['movie', '..', '..', '4', 'list', '1']), null)
assert.equal(tmdbEndpoint(['movie', '.']), null)
assert.equal(tmdbEndpoint(['movie', '...']), null)
assert.equal(tmdbEndpoint(['movie', '%2E%2E']), null)
assert.equal(tmdbEndpoint(['movie', '%252E%252E']), null)
assert.equal(tmdbEndpoint(['movie', '..%2Faccount']), null)
assert.equal(tmdbEndpoint(['movie', 'a/b']), null)
assert.equal(tmdbEndpoint(['movie', 'a\\b']), null)
assert.equal(tmdbEndpoint(['movie', '%']), null)
assert.equal(tmdbEndpoint(Array(9).fill('movie')), null)

const { parseTmdbId } = await import('./tmdb-path.ts')

assert.equal(parseTmdbId('550'), 550)
assert.equal(parseTmdbId('12abc'), null)
assert.equal(parseTmdbId('0'), null)
assert.equal(parseTmdbId('-5'), null)
assert.equal(parseTmdbId('1e3'), null)
assert.equal(parseTmdbId('99999999999'), null)
