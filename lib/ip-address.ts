import { isIP } from 'node:net'

export function validIpAddress(value: string) {
  const address = value.trim()
  return isIP(address) ? address : null
}
