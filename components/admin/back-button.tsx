'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackButton({ fallback = '/admin/movies' }: { fallback?: string }) {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      className="mb-6 px-0 text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push(fallback)
      }}
    >
      <ArrowLeft className="size-4" />
      Back
    </Button>
  )
}
