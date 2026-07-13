import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import { hashApiKey } from '@/lib/api-keys'
import { createPrismaAdapter } from '@/lib/database-provider'
import { checkRateLimit } from '@/lib/ratelimit'

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

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
    const ipLimit = checkRateLimit(`api-auth:${clientIp(request)}`, 120)
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 }
      )
    }

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
