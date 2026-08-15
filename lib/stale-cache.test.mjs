import assert from 'node:assert/strict'
import { createStaleWhileRevalidateCache } from './stale-cache.ts'

let now = 1_000
let loads = 0
const cache = createStaleWhileRevalidateCache({ freshMs: 100, now: () => now })
const load = async () => ++loads

const [first, concurrent] = await Promise.all([
  cache.get('dashboard', load),
  cache.get('dashboard', load),
])
assert.equal(first, 1)
assert.equal(concurrent, 1)
assert.equal(loads, 1, 'cold concurrent reads should share one refresh')

assert.equal(await cache.get('dashboard', load), 1)
assert.equal(loads, 1, 'fresh values should not refresh')

now += 101
let finishRefresh
const refreshValue = new Promise(resolve => {
  finishRefresh = resolve
})
const stale = await cache.get('dashboard', async () => {
  loads++
  return refreshValue
})
assert.equal(stale, 1, 'expired values should be served without waiting')
assert.equal(loads, 2)

assert.equal(await cache.get('dashboard', load), 1)
assert.equal(loads, 2, 'stale concurrent reads should share the background refresh')

finishRefresh(2)
await refreshValue
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(await cache.get('dashboard', load), 2)

cache.clear()
assert.equal(await cache.get('dashboard', load), 3)
assert.equal(loads, 3, 'clearing should force the next read to load again')

console.log('stale-cache tests passed')
