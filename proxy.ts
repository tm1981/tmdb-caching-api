import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { hashApiKey } from '@/lib/api-keys'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

export async function proxy(request: NextRequest) {
  const { nextUrl } = request

  if (nextUrl.pathname.startsWith('/admin')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (token?.role !== 'admin') {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  if (nextUrl.pathname.startsWith('/api/v1/')) {
    const apiKey = request.headers.get('x-api-key')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key. Provide x-api-key header.' },
        { status: 401 }
      )
    }

    try {
      const keyHash = await hashApiKey(apiKey)
      const key = await prisma.apiKey.findUnique({
        where: { keyHash },
      })

      if (!key || !key.active) {
        return NextResponse.json(
          { error: 'Invalid or inactive API key.' },
          { status: 401 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Database error.' },
        { status: 500 }
      )
    }

    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/v1/:path*'],
}
