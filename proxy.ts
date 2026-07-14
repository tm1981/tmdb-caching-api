import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import { hashApiKey } from '@/lib/api-keys'
import { createPrismaAdapter } from '@/lib/database-provider'
import { checkRateLimit } from '@/lib/ratelimit'
import { queueProxyUsage, usageRequestHeaders } from '@/lib/api-usage'

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
    const startedAt = performance.now()
    const ipLimit = checkRateLimit(`api-auth:${clientIp(request)}`, 120)
    if (!ipLimit.allowed) {
      queueProxyUsage(request, 429, startedAt)
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 }
      )
    }

    const apiKey = request.headers.get('x-api-key')

    if (!apiKey) {
      queueProxyUsage(request, 401, startedAt)
      return NextResponse.json(
        { error: 'Missing API key. Provide x-api-key header.' },
        { status: 401 }
      )
    }

    try {
      const keyHash = await hashApiKey(apiKey)
      const key = await prisma.apiKey.findUnique({
        where: { keyHash },
        select: { id: true, label: true, keyPrefix: true, active: true },
      })

      if (!key || !key.active) {
        queueProxyUsage(request, 401, startedAt, key)
        return NextResponse.json(
          { error: 'Invalid or inactive API key.' },
          { status: 401 }
        )
      }

      return NextResponse.next({
        request: { headers: usageRequestHeaders(request, key) },
      })
    } catch {
      queueProxyUsage(request, 500, startedAt)
      return NextResponse.json(
        { error: 'Database error.' },
        { status: 500 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/v1/:path*'],
}
