import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalCwd = process.cwd()
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'tmdb-media-cache-'))

try {
  process.chdir(temporaryRoot)
  process.env.MEDIA_CACHE_MAX_BYTES = '1000'
  const directory = path.join(temporaryRoot, 'data', 'media')
  await mkdir(directory, { recursive: true })

  for (let index = 0; index < 12; index++) {
    const filename = path.join(directory, `existing-${index}.jpg`)
    await writeFile(filename, Buffer.alloc(100, index))
    const modified = new Date(Date.now() - (12 - index) * 1000)
    await utimes(filename, modified, modified)
  }

  const { getCachedMedia, trimMediaCache } = await import('./media-cache.ts')
  await trimMediaCache()

  async function cacheBytes() {
    const names = await readdir(directory)
    const sizes = await Promise.all(names.map(name => stat(path.join(directory, name))))
    return sizes.reduce((sum, details) => sum + details.size, 0)
  }

  assert.equal(await cacheBytes(), 900, 'initial trim should create 10% headroom')

  let responseBytes = 50
  globalThis.fetch = async () => new Response(Buffer.alloc(responseBytes), {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  })

  await getCachedMedia('w500', ['new-1.jpg'])
  await trimMediaCache()
  assert.equal(await cacheBytes(), 950, 'known size below the limit should not rescan or trim')

  responseBytes = 100
  await getCachedMedia('w500', ['new-2.jpg'])
  await trimMediaCache()
  assert.equal(await cacheBytes(), 1050, 'small recent overage should wait for the trim interval')

  await getCachedMedia('w500', ['new-3.jpg'])
  await trimMediaCache()
  assert.ok(await cacheBytes() <= 900, 'an emergency overage should trim to the low-water mark')

  console.log('media-cache tests passed')
} finally {
  process.chdir(originalCwd)
  await rm(temporaryRoot, { recursive: true, force: true })
}
