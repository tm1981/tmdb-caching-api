import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { createHash, randomInt, timingSafeEqual } from 'crypto'
import nodemailer from 'nodemailer'
import prisma from '@/lib/prisma'

type SessionUser = {
  id?: string | null
  role?: string | null
}

const TWO_FACTOR_TTL_MS = 10 * 60 * 1000
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 8

// ponytail: in-memory 2FA works for one app server; move to DB/Redis when running multiple instances.
const twoFactorCodes = new Map<string, { codeHash: string; expiresAt: number }>()
// ponytail: in-memory login throttle is enough for one PM2 process; use Redis if clustering.
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function getHeader(headers: Headers | Record<string, string | string[] | undefined>, key: string) {
  if (headers instanceof Headers) return headers.get(key)
  const value = headers[key] || headers[key.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function loginKey(headers: Headers | Record<string, string | string[] | undefined>, username: string) {
  const forwarded = getHeader(headers, 'x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || getHeader(headers, 'x-real-ip') || 'unknown'
  return `${ip}:${username}`
}

function checkLoginLimit(key: string) {
  const now = Date.now()
  const entry = loginAttempts.get(key)

  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return true
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS) return false
  entry.count++
  return true
}

function clearLoginLimit(key: string) {
  loginAttempts.delete(key)
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

async function sendTwoFactorCode(email: string, code: string) {
  console.log(`2FA code for ${email}: ${code}`)

  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    console.warn('2FA email not sent: SMTP_HOST and SMTP_FROM are not configured.')
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
        const throttleKey = loginKey(req.headers || {}, username)
        if (!checkLoginLimit(throttleKey)) return null

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
            clearLoginLimit(throttleKey)
          } else {
            return null
          }
        } else {
          const code = randomInt(100000, 1000000).toString()
          twoFactorCodes.set(username, {
            codeHash: hashCode(username, code),
            expiresAt: Date.now() + TWO_FACTOR_TTL_MS,
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
