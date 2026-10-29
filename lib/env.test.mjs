import assert from 'node:assert/strict'
import test from 'node:test'
import { assertRequiredEnv, missingRequiredEnv } from './env.ts'

test('missingRequiredEnv lists unset and blank variables', () => {
  assert.deepEqual(missingRequiredEnv({ DATABASE_URL: 'postgresql://x', TMDB_API_KEY: ' ' }), ['TMDB_API_KEY', 'NEXTAUTH_SECRET'])
  assert.deepEqual(missingRequiredEnv({ DATABASE_URL: 'a', TMDB_API_KEY: 'b', NEXTAUTH_SECRET: 'c' }), [])
})

test('assertRequiredEnv names what is missing', () => {
  assert.throws(() => assertRequiredEnv({}), /DATABASE_URL, TMDB_API_KEY, NEXTAUTH_SECRET/)
})
