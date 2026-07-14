'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Film,
  Key,
  Menu,
  RefreshCw,
  Tv,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutButton } from '@/components/admin/sign-out'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/movies', label: 'Movies', icon: Film },
  { href: '/admin/tv', label: 'TV Shows', icon: Tv },
  { href: '/admin/people', label: 'People', icon: User },
  { href: '/admin/keys', label: 'API Keys', icon: Key },
  { href: '/admin/sync', label: 'Sync', icon: RefreshCw },
  { href: '/admin/usage', label: 'Usage & Logs', icon: BarChart3 },
]

function isSelected(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNavigation() {
  const pathname = usePathname()

  return (
    <>
      <aside className="admin-sidebar sticky top-0 hidden h-screen w-44 min-w-44 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-6 py-5">
          <p className="text-base font-semibold tracking-tight">TMDB Admin</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-3">
          {navItems.map((item) => {
            const selected = isSelected(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-3 px-5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  selected && 'bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-sidebar-primary',
                )}
              >
                <item.icon className="size-4" strokeWidth={1.8} />
                <span className="truncate">{item.label}</span>
                {selected && item.href === '/admin/usage' ? (
                  <Activity className="ml-auto size-4" strokeWidth={1.8} />
                ) : null}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <SignOutButton />
        </div>
      </aside>

      <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
        <p className="text-lg font-semibold tracking-tight">TMDB Admin</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open admin navigation">
              <Menu />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              {navItems.map((item) => {
                const selected = isSelected(pathname, item.href)
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} aria-current={selected ? 'page' : undefined}>
                      <item.icon />
                      {item.label}
                      {selected ? <Activity className="ml-auto" /> : null}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </>
  )
}
