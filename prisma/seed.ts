import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { hashApiKey } from '../lib/api-keys'

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
})

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  const existing = await prisma.user.findUnique({
    where: { username },
  })

  if (existing) {
    console.log('Admin user already exists.')
    return
  }

  const hashedPassword = await hash(password, 12)

  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      role: 'admin',
    },
  })

  const apiKey = randomBytes(32).toString('hex')
  const keyHash = await hashApiKey(apiKey)

  await prisma.apiKey.create({
    data: {
      keyHash,
      keyPrefix: apiKey.slice(0, 12),
      label: 'Default',
      active: true,
      ownerId: user.id,
    },
  })

  console.log(`Admin user created: ${username}`)
  console.log(`Default API key: ${apiKey}`)
  console.log('Save this API key - it won\'t be shown again!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
