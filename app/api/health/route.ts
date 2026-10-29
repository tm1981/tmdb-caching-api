export const dynamic = 'force-dynamic'

import prisma from '@/lib/prisma'

const NO_STORE = { 'cache-control': 'no-store' }

// Unauthenticated liveness/readiness probe for uptime monitors; it reveals nothing beyond up/down.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok' }, { headers: NO_STORE })
  } catch (error) {
    console.warn('Health check database ping failed:', error)
    return Response.json({ status: 'error', database: 'unreachable' }, { status: 503, headers: NO_STORE })
  }
}
