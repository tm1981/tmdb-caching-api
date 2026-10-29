import assert from 'node:assert/strict'
import test from 'node:test'
import { mapWithConcurrency } from './concurrency.ts'

test('mapWithConcurrency keeps order and never exceeds the limit', async () => {
  let active = 0
  let peak = 0
  const results = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (value, index) => {
    active++
    peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, value))
    active--
    return value * 10 + index
  })

  assert.deepEqual(results, [50, 11, 42, 23, 34])
  assert.equal(peak, 2)
})

test('mapWithConcurrency handles empty input', async () => {
  assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), [])
})
