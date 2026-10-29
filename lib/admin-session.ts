import prisma from '@/lib/prisma'

export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

// Session JWTs carry the role they were issued with, so a deleted or demoted user would stay
// admin until expiry; this primary-key lookup makes those changes take effect immediately.
export async function isActiveAdmin(id: unknown) {
  const userId = Number(id)
  if (!Number.isInteger(userId) || userId < 1) return false

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role === 'admin'
}
