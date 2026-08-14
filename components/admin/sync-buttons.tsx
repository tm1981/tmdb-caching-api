'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  clearCachedTmdbData,
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? `Sync failed: ${error.message}` : 'Sync failed')
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
          <RefreshCw data-icon="inline-start" className="animate-spin" />
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? `Warmup failed: ${error.message}` : 'Warmup failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
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
            {loading === type ? (
              <RefreshCw data-icon="inline-start" className="animate-spin" />
            ) : null}
            {warmupLabels[type]}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function ClearCachedDataButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const clearCache = async () => {
    setLoading(true)
    try {
      const result = await clearCachedTmdbData()
      toast.success(`Cleared ${result.total.toLocaleString()} cached database rows`)
      router.refresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Cache cleanup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={loading}>
          {loading ? 'Clearing cache...' : 'Clear database cache'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear all cached TMDB data?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes raw mirror responses, normalized movies, and TV shows.
            Accounts, API keys, usage logs, sync history, and Search Fixes data are preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={loading} onClick={clearCache}>
            Clear cache
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
