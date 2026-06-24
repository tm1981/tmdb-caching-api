import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if ((session?.user as { role?: string } | undefined)?.role === 'admin') {
    redirect('/admin/movies')
  }

  redirect('/login')
}
