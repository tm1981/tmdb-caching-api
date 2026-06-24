export async function hashApiKey(apiKey: string) {
  const data = new TextEncoder().encode(apiKey)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
