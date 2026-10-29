import { getDatabaseProvider } from '@/lib/database-provider'

// MySQL/MariaDB collations already match case-insensitively; PostgreSQL needs ILIKE, which Prisma
// only exposes there (the MySQL client types have no `mode`, hence the cast).
export function containsText(value: string) {
  return (getDatabaseProvider() === 'postgresql'
    ? { contains: value, mode: 'insensitive' }
    : { contains: value }) as { contains: string }
}
