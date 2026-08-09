import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024
const DEFAULT_MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024
const inflight = new Map<string, Promise<CachedMedia>>()
let trimPromise: Promise<void> | null = null

export type CachedMedia = {
  body: Buffer
  contentType: string
  cache: 'hit' | 'miss'
}

function positiveBytes(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function cacheDirectory() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'media')
}

function validSize(size: string) {
  if (size === 'original') return true
  const match = /^(?:w|h)(\d{2,4})$/.exec(size)
  if (!match) return false
  const pixels = Number(match[1])
  return pixels >= 32 && pixels <= 2000
}

function validSegment(segment: string) {
  return segment.length > 0
    && segment.length <= 255
    && segment !== '.'
    && segment !== '..'
    && !segment.includes('/')
    && !segment.includes('\\')
    && !segment.includes('\0')
}

function extensionFor(mediaPath: string[]) {
  const extension = path.extname(mediaPath.at(-1) || '').toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(extension) ? extension : null
}

function contentTypeFor(extension: string) {
  return ({
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  } as Record<string, string>)[extension]
}

function validatedRequest(size: string, mediaPath: string[]) {
  const extension = extensionFor(mediaPath)
  if (!validSize(size) || !extension || mediaPath.length > 8 || !mediaPath.every(validSegment)) return null

  const key = `${size}/${mediaPath.join('/')}`
  const filename = `${createHash('sha256').update(key).digest('hex')}${extension}`
  const upstreamPath = mediaPath.map(encodeURIComponent).join('/')
  return { key, filename, extension, upstreamUrl: `${TMDB_IMAGE_BASE}/${size}/${upstreamPath}` }
}

async function fetchAndStore(
  filename: string,
  extension: string,
  upstreamUrl: string,
): Promise<CachedMedia> {
  const directory = cacheDirectory()
  const destination = path.join(directory, filename)

  try {
    return {
      body: await readFile(destination),
      contentType: contentTypeFor(extension),
      cache: 'hit',
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const response = await fetch(upstreamUrl, { cache: 'no-store', redirect: 'error' })
  if (!response.ok) throw new MediaUpstreamError(response.status)

  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || ''
  if (!contentType.startsWith('image/')) throw new MediaUpstreamError(502)

  const maxFileBytes = positiveBytes(process.env.MEDIA_CACHE_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES)
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxFileBytes) throw new MediaUpstreamError(413)

  const body = Buffer.from(await response.arrayBuffer())
  if (body.length > maxFileBytes) throw new MediaUpstreamError(413)

  await mkdir(directory, { recursive: true })
  const temporary = path.join(directory, `.${filename}.${randomUUID()}.tmp`)
  await writeFile(temporary, body, { flag: 'wx' })
  try {
    await rename(temporary, destination)
  } catch (error) {
    await rm(temporary, { force: true })
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }

  return { body, contentType, cache: 'miss' }
}

export class InvalidMediaPathError extends Error {}

export class MediaUpstreamError extends Error {
  constructor(readonly status: number) {
    super(`TMDB image request failed with status ${status}`)
  }
}

export async function getCachedMedia(size: string, mediaPath: string[]) {
  const request = validatedRequest(size, mediaPath)
  if (!request) throw new InvalidMediaPathError('Invalid TMDB media path')

  const existing = inflight.get(request.key)
  if (existing) return existing

  const pending = fetchAndStore(request.filename, request.extension, request.upstreamUrl)
    .finally(() => inflight.delete(request.key))
  inflight.set(request.key, pending)
  return pending
}

export function trimMediaCache() {
  if (trimPromise) return trimPromise

  trimPromise = (async () => {
    const directory = cacheDirectory()
    let names: string[]
    try {
      names = await readdir(directory)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }

    const files = (await Promise.all(names.filter(name => !name.endsWith('.tmp')).map(async name => {
      const filename = path.join(directory, name)
      const details = await stat(filename)
      return { filename, size: details.size, modified: details.mtimeMs }
    }))).sort((a, b) => a.modified - b.modified)

    const maxCacheBytes = positiveBytes(process.env.MEDIA_CACHE_MAX_BYTES, DEFAULT_MAX_CACHE_BYTES)
    let total = files.reduce((sum, file) => sum + file.size, 0)
    for (const file of files) {
      if (total <= maxCacheBytes) break
      await rm(file.filename, { force: true })
      total -= file.size
    }
  })().finally(() => {
    trimPromise = null
  })

  return trimPromise
}

export function mediaBaseUrl(requestOrigin: string) {
  const configured = process.env.MEDIA_PUBLIC_URL || process.env.NEXTAUTH_URL || requestOrigin
  return `${configured.replace(/\/$/, '')}/media/t/p/`
}

export function withLocalMediaConfiguration(payload: unknown, requestOrigin: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload
  const images = (payload as { images?: unknown }).images
  if (!images || typeof images !== 'object' || Array.isArray(images)) return payload

  const baseUrl = mediaBaseUrl(requestOrigin)
  return {
    ...payload,
    images: {
      ...images,
      base_url: baseUrl,
      secure_base_url: baseUrl,
    },
  }
}
