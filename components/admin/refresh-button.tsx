'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  refreshMovieFromTmdb,
  refreshPersonFromTmdb,
  refreshTvFromTmdb,
} from '@/app/actions/db'

type RefreshType = 'movie' | 'tv' | 'person'

const refreshActions = {
  movie: refreshMovieFromTmdb,
  tv: refreshTvFromTmdb,
  person: refreshPersonFromTmdb,
} satisfies Record<RefreshType, (id: number) => Promise<{ success: number; errors: number }>>

export function RefreshButton({
  label = 'Refresh From TMDB',
  type,
  id,
}: {
  label?: string
  type: RefreshType
  id: number
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const refresh = async () => {
    setLoading(true)
    try {
      const result = await refreshActions[type](id)
      if (result.errors) {
        toast.error('Refresh completed with errors')
      } else {
        toast.success('Refreshed from TMDB')
      }
      router.refresh()
    } catch (error: any) {
      toast.error(`Refresh failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" onClick={refresh} disabled={loading}>
      {loading && <RefreshCw className="size-4 animate-spin" />}
      {label}
    </Button>
  )
}
