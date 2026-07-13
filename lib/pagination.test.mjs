import assert from 'node:assert/strict'

const { paginationParams } = await import('./pagination.ts')

assert.deepEqual(paginationParams('2', '50'), { page: 2, limit: 50, skip: 50 })
assert.deepEqual(paginationParams('-2', '5000'), { page: 1, limit: 100, skip: 0 })
assert.deepEqual(paginationParams('abc', '0'), { page: 1, limit: 20, skip: 0 })
