import assert from 'node:assert/strict'

const {
  clientCountryCode,
  clientIp,
  countryName,
  parseUsageRange,
  percentage,
  percentChange,
  polylinePoints,
  sanitizeQuery,
  utcHour,
} = await import('./usage.ts')

const headers = new Headers({
  'x-forwarded-for': '2001:db8::1, 10.0.0.1',
  'cf-ipcountry': 'il',
})

assert.equal(clientIp(headers), '2001:db8::1')
assert.equal(clientCountryCode(headers), 'IL')
assert.equal(clientCountryCode(new Headers({ 'cf-ipcountry': 'XX' })), null)
assert.equal(countryName('USA'), 'Unknown')
assert.equal(countryName(null), 'Unknown')
assert.equal(parseUsageRange('7d'), '7d')
assert.equal(parseUsageRange('forever'), '24h')
assert.equal(utcHour(new Date('2026-07-14T12:34:56.789Z')).toISOString(), '2026-07-14T12:00:00.000Z')
assert.equal(
  sanitizeQuery('q=batman&api_key=secret&ACCESS_TOKEN=also-secret'),
  'q=batman&api_key=%5Bredacted%5D&ACCESS_TOKEN=%5Bredacted%5D',
)
assert.equal(percentage(1, 4), 25)
assert.equal(percentage(1, 0), 0)
assert.equal(percentChange(15, 10), 50)
assert.equal(percentChange(0, 0), 0)
assert.equal(polylinePoints([], 100, 20), '')
assert.equal(polylinePoints([0, 10], 100, 20), '0.00,20.00 100.00,0.00')
