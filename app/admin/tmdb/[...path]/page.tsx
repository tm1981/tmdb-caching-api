export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCachedTmdb } from '@/lib/tmdb-cache'
import { Badge } from '@/components/ui/badge'

const BLOCKED_ROOTS = new Set(['account', 'authentication', 'guest_session', 'list'])

export default async function RawTmdbPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { path } = await params
  const query = await searchParams
  const cleanPath = path.map(decodeURIComponent).filter(Boolean)
  const root = cleanPath[0]

  if (!root || BLOCKED_ROOTS.has(root)) notFound()

  const endpoint = `/${cleanPath.map(encodeURIComponent).join('/')}`
  const paramsObject = Object.fromEntries(
    Object.entries(query)
      .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  )
  const result = await getCachedTmdb(endpoint, paramsObject)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href="/admin/sync"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Back to admin
      </Link>

      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Raw TMDB</h1>
          <p className="text-sm text-muted-foreground font-mono">{endpoint}</p>
        </div>
        <Badge variant={result.cache === 'hit' ? 'default' : 'secondary'}>
          {result.cache}
        </Badge>
      </div>

      <pre className="overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
        {JSON.stringify(result.payload, null, 2)}
      </pre>
    </div>
  )
}
