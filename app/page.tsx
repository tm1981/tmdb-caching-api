import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('next-auth.session-token')

  if (sessionToken) {
    redirect('/admin/movies')
  }

  redirect('/login')
}
