import assert from 'node:assert/strict'

const originalProvider = process.env.DATABASE_PROVIDER
const originalUrl = process.env.DATABASE_URL

try {
  const { getPrismaMigrationsPath, getPrismaSchema } = await import('./database-provider.ts')

  process.env.DATABASE_PROVIDER = 'mysql'
  process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/tmdb_service'
  assert.equal(getPrismaSchema(), './prisma/schema.mysql.prisma')
  assert.equal(getPrismaMigrationsPath(), './prisma/migrations-mysql')

  process.env.DATABASE_PROVIDER = 'postgresql'
  process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/tmdb_service'
  assert.equal(getPrismaSchema(), './prisma/schema.prisma')
  assert.equal(getPrismaMigrationsPath(), './prisma/migrations')
} finally {
  if (originalProvider === undefined) delete process.env.DATABASE_PROVIDER
  else process.env.DATABASE_PROVIDER = originalProvider
  if (originalUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalUrl
}
