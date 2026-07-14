import { execFile } from 'node:child_process'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { Reader } from '@maxmind/geoip2-node'

const execFileAsync = promisify(execFile)
const downloadUrl =
  'https://download.maxmind.com/geoip/databases/GeoLite2-Country/download?suffix=tar.gz'

const targetPath = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.GEOIP_DATABASE_PATH ?? 'data/geoip/GeoLite2-Country.mmdb',
)

async function validateDatabase(filePath) {
  const reader = await Reader.open(filePath)
  const countryCode = reader.country('1.1.1.1').country?.isoCode

  if (!countryCode) {
    throw new Error('The database did not return a country for the validation IP.')
  }

  return countryCode
}

async function findDatabase(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isFile() && entry.name === 'GeoLite2-Country.mmdb') return entryPath

    if (entry.isDirectory()) {
      const found = await findDatabase(entryPath)
      if (found) return found
    }
  }

  return null
}

async function request(method, authorization) {
  const response = await fetch(downloadUrl, {
    method,
    headers: { Authorization: authorization },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`MaxMind ${method} request failed with HTTP ${response.status}.`)
  }

  return response
}

export async function installDatabase() {
  const accountId = process.env.MAXMIND_ACCOUNT_ID
  const licenseKey = process.env.MAXMIND_LICENSE_KEY

  if (!accountId || !licenseKey) {
    throw new Error('Set MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY before updating GeoIP.')
  }

  const authorization = `Basic ${Buffer.from(`${accountId}:${licenseKey}`).toString('base64')}`
  const headResponse = await request('HEAD', authorization)
  const lastModified = headResponse.headers.get('last-modified')
  const remoteModifiedAt = lastModified ? new Date(lastModified) : null

  if (remoteModifiedAt && !Number.isNaN(remoteModifiedAt.valueOf())) {
    try {
      const current = await stat(targetPath)
      if (current.mtimeMs >= remoteModifiedAt.valueOf()) {
        try {
          const countryCode = await validateDatabase(targetPath)
          console.log(`GeoIP database is current: ${targetPath}`)
          return { updated: false, countryCode }
        } catch {
          // A corrupt local file must be replaced even when its timestamp is current.
        }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'tmdb-geoip-'))
  const partialPath = `${targetPath}.${process.pid}.${Date.now()}.partial`

  try {
    const archivePath = path.join(temporaryDirectory, 'GeoLite2-Country.tar.gz')
    const response = await request('GET', authorization)
    await writeFile(archivePath, Buffer.from(await response.arrayBuffer()))

    try {
      await execFileAsync('tar', ['-xzf', archivePath, '-C', temporaryDirectory])
    } catch (error) {
      throw new Error('Could not extract the GeoIP archive. Ensure the system tar command is installed.', {
        cause: error,
      })
    }

    const downloadedPath = await findDatabase(temporaryDirectory)
    if (!downloadedPath) throw new Error('The archive did not contain GeoLite2-Country.mmdb.')

    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(downloadedPath, partialPath)
    const countryCode = await validateDatabase(partialPath)

    try {
      await rename(partialPath, targetPath)
    } catch (error) {
      if (process.platform !== 'win32' || !['EEXIST', 'EPERM'].includes(error?.code)) throw error
      await rm(targetPath, { force: true })
      await rename(partialPath, targetPath)
    }

    if (remoteModifiedAt && !Number.isNaN(remoteModifiedAt.valueOf())) {
      await utimes(targetPath, remoteModifiedAt, remoteModifiedAt)
    }

    console.log(`Updated GeoIP database (${countryCode} validation): ${targetPath}`)
    return { updated: true, countryCode }
  } finally {
    await rm(partialPath, { force: true })
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}
