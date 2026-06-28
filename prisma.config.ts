import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'
import { getPrismaSchema } from './lib/database-provider'

export default defineConfig({
  schema: getPrismaSchema(),
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
