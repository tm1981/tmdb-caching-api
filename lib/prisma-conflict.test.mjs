import assert from 'node:assert/strict'

const { isPrismaUniqueConflict, retryPrismaUniqueConflict } = await import('./prisma-conflict.ts')

assert.equal(isPrismaUniqueConflict({ code: 'P2002' }), true)
assert.equal(isPrismaUniqueConflict({ code: 'P2003' }), false)
assert.equal(isPrismaUniqueConflict(null), false)

let retries = 0
const recovered = await retryPrismaUniqueConflict(
  async () => { throw { code: 'P2002' } },
  async () => { retries += 1; return 'updated' },
)
assert.equal(recovered, 'updated')
assert.equal(retries, 1)

const original = { code: 'P2003' }
await assert.rejects(
  retryPrismaUniqueConflict(async () => { throw original }, async () => 'not reached'),
  error => error === original,
)
