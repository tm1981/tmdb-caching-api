const REQUIRED_ENV = ['DATABASE_URL', 'TMDB_API_KEY', 'NEXTAUTH_SECRET'] as const

export function missingRequiredEnv(env: Record<string, string | undefined> = process.env) {
  return REQUIRED_ENV.filter(name => !env[name]?.trim())
}

// Fails startup with a clear message instead of the first request crashing on a missing secret.
export function assertRequiredEnv(env: Record<string, string | undefined> = process.env) {
  const missing = missingRequiredEnv(env)
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`)
  }
}
