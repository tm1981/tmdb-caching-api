'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  syncTrendingMovies,
  syncTrendingTv,
  syncTopRatedMovies,
  syncTopRatedTv,
  warmupTmdbCache,
  type TmdbWarmupType,
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
  const router = useRouter()

  const runSync = async () => {
    setLoading(true)
    try {
      const result = await syncFunctions[type]()
      toast.success(
        `Synced ${result.success} items${result.errors ? ` (${result.errors} errors)` : ''}`
      )
      router.refresh()
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

const warmupLabels: Record<TmdbWarmupType, string> = {
  core: 'Core Metadata',
  trending: 'Trending',
  popular: 'Popular Lists',
}

export function CacheWarmupButtons() {
  const [loading, setLoading] = useState<TmdbWarmupType | null>(null)
  const [pages, setPages] = useState(1)
  const router = useRouter()

  const runWarmup = async (type: TmdbWarmupType) => {
    setLoading(type)
    try {
      const result = await warmupTmdbCache(type, pages)
      toast.success(
        `Warmed ${result.success} endpoints${result.errors ? ` (${result.errors} errors)` : ''}`
      )
      router.refresh()
    } catch (error: any) {
      toast.error(`Warmup failed: ${error.message}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="w-24">
          <Label htmlFor="warmup-pages">Pages</Label>
          <Input
            id="warmup-pages"
            type="number"
            min={1}
            max={20}
            value={pages}
            onChange={(event) => {
              const value = Number(event.target.value)
              setPages(Math.min(Math.max(value || 1, 1), 20))
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(warmupLabels) as TmdbWarmupType[]).map((type) => (
          <Button
            key={type}
            variant="secondary"
            onClick={() => runWarmup(type)}
            disabled={loading !== null}
          >
            {loading === type && <RefreshCw className="size-4 mr-2 animate-spin" />}
            {warmupLabels[type]}
          </Button>
        ))}
      </div>
    </div>
  )
}
