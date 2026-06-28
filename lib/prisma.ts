import { PrismaClient } from '@prisma/client'
import { createPrismaAdapter } from '@/lib/database-provider'

const prismaClientSingleton = () => {
  return new PrismaClient({ adapter: createPrismaAdapter() })
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

const prisma = globalForPrisma.prisma ?? (globalForPrisma.prisma = prismaClientSingleton())

export default prisma

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
