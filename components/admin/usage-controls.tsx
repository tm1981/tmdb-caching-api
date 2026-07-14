'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { updateGeoIpDatabase } from '@/app/actions/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UsageRange, UsageStatusFilter } from '@/lib/usage'

type CountryOption = { code: string | null; name: string }

export function GeoIpUpdateButton() {
  const [pending, startTransition] = useTransition()

  function updateDatabase() {
    startTransition(async () => {
      try {
        const result = await updateGeoIpDatabase()
        if ('error' in result) toast.error(result.error)
        else toast.success(result.updated ? 'GeoIP database updated.' : 'GeoIP database is already current.')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'GeoIP update failed.')
      }
    })
  }

  return (
    <Button variant="outline" onClick={updateDatabase} disabled={pending}>
      <RefreshCw data-icon="inline-start" className={pending ? 'animate-spin' : undefined} />
      {pending ? 'Updating…' : 'Update GeoIP'}
    </Button>
  )
}

function useUsageQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(values: Record<string, string>) {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(values)) {
      if (!value || value === 'all') params.delete(key)
      else params.set(key, value)
    }
    params.delete('page')
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return { router, update, pending }
}

export function UsageRangeControls({ range }: { range: UsageRange }) {
  const { router, update, pending } = useUsageQuery()

  return (
    <div className="flex items-center gap-2">
      <Select value={range} onValueChange={value => update({ range: value })} disabled={pending}>
        <SelectTrigger className="w-[170px]" aria-label="Usage time range">
          <CalendarDays className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button onClick={() => router.refresh()} disabled={pending} aria-label="Refresh usage data">
        <RefreshCw data-icon="inline-start" />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    </div>
  )
}

function FilterSelects({
  status,
  country,
  countries,
  pending,
  update,
}: {
  status: UsageStatusFilter
  country: string
  countries: CountryOption[]
  pending: boolean
  update: (values: Record<string, string>) => void
}) {
  return (
    <>
      <Select value={status} onValueChange={value => update({ status: value })} disabled={pending}>
        <SelectTrigger className="w-full md:w-[190px]" aria-label="Filter by response status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="2xx">Successful (2xx)</SelectItem>
            <SelectItem value="4xx">Client errors (4xx)</SelectItem>
            <SelectItem value="5xx">Server errors (5xx)</SelectItem>
            <SelectItem value="429">Rate limited (429)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select value={country} onValueChange={value => update({ country: value })} disabled={pending}>
        <SelectTrigger className="w-full md:w-[190px]" aria-label="Filter by country">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map(item => (
              <SelectItem key={item.code || 'unknown'} value={item.code || 'unknown'}>
                {item.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  )
}

export function UsageFilters({
  search: initialSearch,
  status,
  country,
  countries,
}: {
  search: string
  status: UsageStatusFilter
  country: string
  countries: CountryOption[]
}) {
  const { update, pending } = useUsageQuery()
  const [search, setSearch] = useState(initialSearch)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  function submitSearch() {
    update({ search: search.trim() })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-0 flex-1 md:max-w-[300px]">
        <span className="sr-only">Filter recent requests</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={event => {
            setSearch(event.target.value)
            if (!event.target.value) update({ search: '' })
          }}
          onBlur={submitSearch}
          onKeyDown={event => {
            if (event.key === 'Enter') submitSearch()
          }}
          placeholder="Filter endpoint, IP, country, or key"
          className="pl-9"
          disabled={pending}
        />
      </label>
      <div className="hidden items-center gap-2 md:flex">
        <FilterSelects
          status={status}
          country={country}
          countries={countries}
          pending={pending}
          update={update}
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        className="md:hidden"
        aria-label="Toggle request filters"
        aria-expanded={showMobileFilters}
        onClick={() => setShowMobileFilters(value => !value)}
      >
        <SlidersHorizontal />
      </Button>
      {showMobileFilters ? (
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:hidden">
          <FilterSelects
            status={status}
            country={country}
            countries={countries}
            pending={pending}
            update={update}
          />
        </div>
      ) : null}
    </div>
  )
}
