import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { hashApiKey } from '../lib/api-keys'
import { createPrismaAdapter } from '../lib/database-provider'

const prisma = new PrismaClient({
  adapter: createPrismaAdapter(),
})

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin@example.com'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  const existing = await prisma.user.findUnique({
    where: { username },
  })

  if (existing) {
    if (process.env.ADMIN_PASSWORD) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { password: await hash(process.env.ADMIN_PASSWORD, 12) },
      })
      console.log('Admin password updated.')
    } else {
      console.log('Admin user already exists.')
    }
    return
  }

  const firstAdmin = await prisma.user.findFirst({
    where: { role: 'admin' },
  })

  if (firstAdmin) {
    await prisma.user.update({
      where: { id: firstAdmin.id },
      data: {
        username,
        ...(process.env.ADMIN_PASSWORD
          ? { password: await hash(process.env.ADMIN_PASSWORD, 12) }
          : {}),
      },
    })
    console.log(`Admin user updated: ${username}`)
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
