export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { after, NextResponse } from 'next/server'
import {
  getCachedMedia,
  InvalidMediaPathError,
  MediaUpstreamError,
  trimMediaCache,
} from '@/lib/media-cache'

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string; path: string[] }> },
) {
  const { size, path } = await params

  try {
    const media = await getCachedMedia(size, path)
    if (media.cache === 'miss') {
      after(() => trimMediaCache().catch(error => console.warn('Media cache trim failed:', error)))
    }

    return new NextResponse(Uint8Array.from(media.body).buffer, {
      headers: {
        'cache-control': CACHE_CONTROL,
        'content-type': media.contentType,
        'x-content-type-options': 'nosniff',
        'x-media-cache': media.cache,
        ...(media.contentType === 'image/svg+xml' && { 'content-security-policy': "sandbox; default-src 'none'" }),
      },
    })
  } catch (error) {
    if (error instanceof InvalidMediaPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof MediaUpstreamError) {
      return NextResponse.json(
        { error: 'TMDB image is unavailable.' },
        { status: error.status, headers: { 'cache-control': 'no-store' } },
      )
    }

    console.error('Media cache failed:', error)
    return NextResponse.json(
      { error: 'Media cache failed.' },
      { status: 502, headers: { 'cache-control': 'no-store' } },
    )
  }
}
