'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  syncTrendingMovies,
  syncTrendingTv,
  syncTopRatedMovies,
  syncTopRatedTv,
} from '@/app/actions/db'

type SyncType = 'trending-movies' | 'trending-tv' | 'top-rated-movies' | 'top-rated-tv'

interface SyncButtonsProps {
  type: SyncType
  label: string
}

const syncFunctions: Record<SyncType, () => Promise<{ success: number; errors: number }>> = {
  'trending-movies': syncTrendingMovies,
  'trending-tv': syncTrendingTv,
  'top-rated-movies': syncTopRatedMovies,
  'top-rated-tv': syncTopRatedTv,
}

export function SyncButtons({ type, label }: SyncButtonsProps) {
  const [loading, setLoading] = useState(false)

  const runSync = async () => {
    setLoading(true)
    try {
      const result = await syncFunctions[type]()
      toast.success(
        `Synced ${result.success} items${result.errors ? ` (${result.errors} errors)` : ''}`
      )
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={runSync}
      disabled={loading}
    >
      {loading ? (
        <>
          <RefreshCw className="size-4 mr-2 animate-spin" />
          Syncing...
        </>
      ) : (
        label
      )}
    </Button>
  )
}
