import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'
import { getPrismaMigrationsPath, getPrismaSchema } from './lib/database-provider'

export default defineConfig({
  schema: getPrismaSchema(),
  migrations: {
    path: getPrismaMigrationsPath(),
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
