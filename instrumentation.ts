export async function register() {
  // `next build` loads this too; only check a server that is actually starting.
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return

  const { assertRequiredEnv } = await import('./lib/env')
  const { getDatabaseProvider } = await import('./lib/database-provider')
  assertRequiredEnv()
  getDatabaseProvider()
}
