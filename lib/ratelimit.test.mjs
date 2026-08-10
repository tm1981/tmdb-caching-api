import assert from 'node:assert/strict'

const { checkRequestRateLimit, rateLimitBypassed, rateLimitResponse } = await import('./ratelimit.ts')
const original = process.env.RATE_LIMIT_BYPASS_IPS

try {
  process.env.RATE_LIMIT_BYPASS_IPS = '203.0.113.10, 2001:db8::1'

  assert.equal(rateLimitBypassed(new Headers({ 'x-forwarded-for': '203.0.113.10, 10.0.0.1' })), true)
  assert.equal(rateLimitBypassed(new Headers({ 'x-real-ip': '2001:db8::1' })), true)
  assert.equal(rateLimitBypassed(new Headers({ 'x-real-ip': '203.0.113.11' })), false)

  const bypassed = checkRequestRateLimit(new Headers({ 'x-real-ip': '203.0.113.10' }), 'test', 1)
  assert.equal(bypassed.bypassed, true)
  assert.equal(bypassed.allowed, true)

  const limited = checkRequestRateLimit(new Headers({ 'x-real-ip': '203.0.113.11' }), 'limited', 1)
  assert.equal(limited.allowed, true)
  const rejected = checkRequestRateLimit(new Headers({ 'x-real-ip': '203.0.113.11' }), 'limited', 1)
  const response = rateLimitResponse(rejected)
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('x-ratelimit-source'), 'tmdb-service')
  assert.equal(response.headers.has('retry-after'), true)
  assert.deepEqual(await response.json(), {
    error: 'Rate limit exceeded. Try again later.',
    code: 'RATE_LIMITED',
    source: 'tmdb-service',
    retry_after: Number(response.headers.get('retry-after')),
  })
} finally {
  if (original === undefined) delete process.env.RATE_LIMIT_BYPASS_IPS
  else process.env.RATE_LIMIT_BYPASS_IPS = original
}
