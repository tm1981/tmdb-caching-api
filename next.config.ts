import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Browsers ignore HSTS on plain HTTP, so this only takes effect behind the HTTPS domain.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
]

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.217'],
  poweredByHeader: false,
  // The reverse proxy/CDN compresses responses; Next's own gzip only adds CPU work and
  // emits MaxListenersExceededWarning on large streamed responses.
  compress: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
