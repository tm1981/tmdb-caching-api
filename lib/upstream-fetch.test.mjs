import assert from 'node:assert/strict'

const {
  describeNetworkError,
  isNetworkError,
  isRetryableNetworkError,
  isTimeoutError,
  networkErrorStatus,
  withNetworkRetry,
} = await import('./upstream-fetch.ts')

function socketError(code) {
  return Object.assign(new Error(`read ${code}`), { code })
}

const connectReset = new TypeError('fetch failed', { cause: socketError('ECONNRESET') })
const bodyReset = new TypeError('terminated', { cause: socketError('ECONNRESET') })
const connectTimeout = new TypeError('fetch failed', { cause: socketError('UND_ERR_CONNECT_TIMEOUT') })
const abortTimeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
const refused = new TypeError('fetch failed', { cause: socketError('ECONNREFUSED') })

assert.equal(isNetworkError(connectReset), true)
assert.equal(isNetworkError(bodyReset), true)
assert.equal(isNetworkError(new Error('boom')), false)
assert.equal(isNetworkError(new TypeError('x is not a function')), false)

assert.equal(isRetryableNetworkError(connectReset), true)
assert.equal(isRetryableNetworkError(bodyReset), true)
assert.equal(isRetryableNetworkError(connectTimeout), false)
assert.equal(isRetryableNetworkError(abortTimeout), false)
assert.equal(isRetryableNetworkError(refused), false)

assert.equal(isTimeoutError(connectTimeout), true)
assert.equal(isTimeoutError(abortTimeout), true)
assert.equal(networkErrorStatus(abortTimeout), 504)
assert.equal(networkErrorStatus(connectReset), 502)
assert.equal(describeNetworkError(connectReset), 'fetch failed (ECONNRESET)')
assert.equal(describeNetworkError(abortTimeout), 'timed out')

let calls = 0
assert.equal(await withNetworkRetry(async () => {
  calls++
  if (calls === 1) throw bodyReset
  return 'ok'
}), 'ok')
assert.equal(calls, 2)

calls = 0
await assert.rejects(withNetworkRetry(async () => {
  calls++
  throw connectReset
}), connectReset)
assert.equal(calls, 2, 'retries only once')

calls = 0
await assert.rejects(withNetworkRetry(async () => {
  calls++
  throw abortTimeout
}), abortTimeout)
assert.equal(calls, 1, 'timeouts are not retried')
