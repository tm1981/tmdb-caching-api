import assert from 'node:assert/strict'

const { validIpAddress } = await import('./ip-address.ts')

assert.equal(validIpAddress(' 203.0.113.7 '), '203.0.113.7')
assert.equal(validIpAddress('2001:db8::1'), '2001:db8::1')
assert.equal(validIpAddress('unknown'), null)
assert.equal(validIpAddress('203.0.113.7.example.com'), null)
