import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaPg } from '@prisma/adapter-pg'

export function getDatabaseProvider() {
  const provider = process.env.DATABASE_PROVIDER || 'postgresql'

  if (provider === 'postgresql' || provider === 'mysql' || provider === 'mariadb') {
    return provider
  }

  throw new Error('DATABASE_PROVIDER must be postgresql, mysql, or mariadb')
}

export function getPrismaSchema() {
  return getDatabaseProvider() === 'postgresql'
    ? './prisma/schema.prisma'
    : './prisma/schema.mysql.prisma'
}

export function createPrismaAdapter() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  if (getDatabaseProvider() === 'postgresql') {
    return new PrismaPg({ connectionString: url })
  }

  const databaseUrl = new URL(url)
  return new PrismaMariaDb({
    host: databaseUrl.hostname,
    port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.replace(/^\//, ''),
  })
}
