import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import prisma from '@/lib/prisma'

type SessionUser = {
  role?: string | null
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user || !(await compare(credentials.password, user.password))) {
          return null
        }

        return {
          id: user.id.toString(),
          name: user.username,
          email: user.username,
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
        token.role = (user as SessionUser).role
      }
      return token
    },
    async session({ session, token }) {
      ;(session.user as SessionUser).role = token.role as string | undefined
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
