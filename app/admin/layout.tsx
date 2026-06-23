import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Film, Tv, Key, RefreshCw, User } from 'lucide-react'
import { SignOutButton } from '@/components/admin/sign-out'

const navItems = [
  { href: '/admin/movies', label: 'Movies', icon: Film },
  { href: '/admin/tv', label: 'TV Shows', icon: Tv },
  { href: '/admin/people', label: 'People', icon: User },
  { href: '/admin/keys', label: 'API Keys', icon: Key },
  { href: '/admin/sync', label: 'Sync', icon: RefreshCw },
]

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="w-64 min-w-64 flex-shrink-0 bg-background border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">TMDB Admin</h1>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}
