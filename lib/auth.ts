import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { createHash, randomInt, timingSafeEqual } from 'crypto'
import nodemailer from 'nodemailer'
import prisma from '@/lib/prisma'
import { clientIp } from '@/lib/usage'

type SessionUser = {
  id?: string | null
  role?: string | null
}

type RequestHeaders = Headers | Record<string, string | string[] | undefined>

const TWO_FACTOR_TTL_MS = 10 * 60 * 1000
const TWO_FACTOR_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 8
// Caps guesses against one account even when an attacker rotates source IPs.
const ACCOUNT_MAX_ATTEMPTS = 30
const PRUNE_THRESHOLD = 10_000

// ponytail: in-memory 2FA works for one app server; move to DB/Redis when running multiple instances.
const twoFactorCodes = new Map<string, { codeHash: string; expiresAt: number; attempts: number }>()
// ponytail: in-memory login throttle is enough for one PM2 process; use Redis if clustering.
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function toHeaders(headers: RequestHeaders) {
  if (headers instanceof Headers) return headers
  const result = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) result.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  return result
}

function loginKeys(headers: RequestHeaders, username: string) {
  return [`ip:${clientIp(toHeaders(headers))}:${username}`, `account:${username}`]
}

function pruneExpired<T>(map: Map<string, T>, expiresAt: (value: T) => number) {
  if (map.size < PRUNE_THRESHOLD) return
  const now = Date.now()
  for (const [key, value] of map) {
    if (expiresAt(value) <= now) map.delete(key)
  }
}

function checkLoginLimit(keys: string[]) {
  const now = Date.now()
  pruneExpired(loginAttempts, entry => entry.resetAt)

  const limits = keys.map(key => key.startsWith('account:') ? ACCOUNT_MAX_ATTEMPTS : LOGIN_MAX_ATTEMPTS)
  const entries = keys.map(key => {
    const entry = loginAttempts.get(key)
    return entry && entry.resetAt > now ? entry : null
  })

  if (entries.some((entry, index) => entry && entry.count >= limits[index])) return false

  keys.forEach((key, index) => {
    const entry = entries[index]
    if (entry) entry.count++
    else loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
  })
  return true
}

function clearLoginLimit(keys: string[]) {
  for (const key of keys) loginAttempts.delete(key)
}

function hashCode(username: string, code: string) {
  return createHash('sha256')
    .update(`${process.env.NEXTAUTH_SECRET}:${username}:${code}`)
    .digest('hex')
}

function codeMatches(expectedHash: string, username: string, code: string) {
  const actual = Buffer.from(hashCode(username, code), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Codes are only printed when email cannot deliver them, and never in production unless
// the operator explicitly opts in; otherwise anyone with log access could bypass 2FA.
function logUndeliveredCode(email: string, code: string) {
  if (process.env.NODE_ENV !== 'production' || process.env.TWO_FACTOR_CONSOLE_FALLBACK === 'true') {
    console.log(`2FA code for ${email}: ${code}`)
  }
}

async function sendTwoFactorCode(email: string, code: string) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    console.warn('2FA email not sent: SMTP_HOST and SMTP_FROM are not configured.')
    logUndeliveredCode(email, code)
    return
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  })

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Your TMDB Service login code',
      text: `Your TMDB Service login code is ${code}. It expires in 10 minutes.`,
    })
  } catch (error) {
    console.warn('2FA email not sent:', error)
    logUndeliveredCode(email, code)
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        twoFactorCode: { label: 'Two-factor code', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const username = credentials.username.toLowerCase()
        const throttleKeys = loginKeys(req.headers || {}, username)
        if (!checkLoginLimit(throttleKeys)) return null

        const user = await prisma.user.findUnique({
          where: { username },
        })

        if (!user || !(await compare(credentials.password, user.password))) {
          return null
        }

        if (!username.includes('@')) {
          throw new Error('EmailUsernameRequired')
        }

        const savedCode = twoFactorCodes.get(username)
        if (credentials.twoFactorCode && savedCode) {
          if (
            savedCode.expiresAt > Date.now() &&
            codeMatches(savedCode.codeHash, username, credentials.twoFactorCode)
          ) {
            twoFactorCodes.delete(username)
            clearLoginLimit(throttleKeys)
          } else {
            // A code dies after a few wrong guesses so the 6-digit space cannot be brute-forced.
            savedCode.attempts++
            if (savedCode.attempts >= TWO_FACTOR_MAX_ATTEMPTS) twoFactorCodes.delete(username)
            return null
          }
        } else {
          const code = randomInt(100000, 1000000).toString()
          pruneExpired(twoFactorCodes, entry => entry.expiresAt)
          twoFactorCodes.set(username, {
            codeHash: hashCode(username, code),
            expiresAt: Date.now() + TWO_FACTOR_TTL_MS,
            attempts: 0,
          })
          await sendTwoFactorCode(username, code)
          throw new Error('TwoFactorRequired')
        }

        return {
          id: user.id.toString(),
          name: username,
          email: username,
          role: user.role,
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as SessionUser).role
      }
      return token
    },
    async session({ session, token }) {
      ;(session.user as SessionUser).role = token.role as string | undefined
      ;(session.user as SessionUser).id = token.id as string | undefined
      return session
    },
  },
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions)

  if ((session?.user as SessionUser | undefined)?.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  return session
}
