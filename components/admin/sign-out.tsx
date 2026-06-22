'use client'

import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      <LogOut className="size-4" />
      Sign Out
    </Button>
  )
}
