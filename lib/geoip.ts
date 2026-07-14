import { isIP } from 'node:net'
import path from 'node:path'
import { Reader } from '@maxmind/geoip2-node'

const RETRY_DELAY_MS = 60_000

type GeoIpReader = Awaited<ReturnType<typeof Reader.open>>

let readerPromise: Promise<GeoIpReader | null> | null = null
let retryAfter = 0
let warnedUnavailable = false

function databasePath() {
  return path.resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.GEOIP_DATABASE_PATH ?? 'data/geoip/GeoLite2-Country.mmdb',
  )
}

async function getReader(): Promise<GeoIpReader | null> {
  if (Date.now() < retryAfter) return null

  if (!readerPromise) {
    const filePath = databasePath()

    readerPromise = Reader.open(filePath, {
      watchForUpdates: true,
      watchForUpdatesNonPersistent: true,
    })
      .then((reader) => {
        warnedUnavailable = false
        retryAfter = 0
        return reader
      })
      .catch((error: unknown) => {
        readerPromise = null
        retryAfter = Date.now() + RETRY_DELAY_MS

        if (!warnedUnavailable) {
          warnedUnavailable = true
          console.warn(`GeoIP database is unavailable at ${filePath}:`, error)
        }

        return null
      })
  }

  return readerPromise
}

export async function geoIpCountryCode(ipAddress: string): Promise<string | null> {
  if (!isIP(ipAddress)) return null

  const reader = await getReader()
  if (!reader) return null

  try {
    const countryCode = reader.country(ipAddress).country?.isoCode?.toUpperCase()
    return countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null
  } catch {
    return null
  }
}
