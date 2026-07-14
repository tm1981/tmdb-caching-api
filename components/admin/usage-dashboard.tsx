import Link from 'next/link'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  Globe2,
  Key,
  ShieldAlert,
} from 'lucide-react'
import { UsageFilters, UsageRangeControls } from '@/components/admin/usage-controls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { countryName, percentage, polylinePoints } from '@/lib/usage'
import type { UsageDashboardData } from '@/lib/usage-dashboard'

const wholeNumber = new Intl.NumberFormat('en-US')
const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
const timeOnly = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

type MetricData = { value: number; change: number; series: number[] }

function Trend({ value, points = false, invert = false }: { value: number; points?: boolean; invert?: boolean }) {
  const positive = value > 0
  const good = invert ? !positive : positive
  const Icon = positive ? ArrowUp : ArrowDown
  const text = points ? `${Math.abs(value).toFixed(2)} pts` : `${Math.abs(value).toFixed(1)}%`

  if (Math.abs(value) < 0.005) {
    return <span className="text-xs text-muted-foreground">No change vs previous period</span>
  }

  return (
    <span className={cn('flex flex-wrap items-center gap-1 text-[10px] leading-tight md:text-xs', good ? 'text-success' : 'text-destructive')}>
      <Icon className="size-3" strokeWidth={2.5} />
      {text} vs previous period
    </span>
  )
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const points = polylinePoints(values, 120, 28)
  return (
    <svg viewBox="0 0 120 28" className="h-6 w-full md:h-8 md:w-28" role="img" aria-label={label}>
      <polyline
        points={points || '0,28 120,28'}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Metric({
  label,
  data,
  format,
  points,
}: {
  label: string
  data: MetricData
  format: (value: number) => string
  points?: boolean
}) {
  return (
    <div className="min-w-0 flex-1 border-r px-2 py-3 last:border-r-0 md:px-4">
      <p className="text-[10px] text-muted-foreground md:text-xs">{label}</p>
      <div className="mt-0.5 flex flex-col items-start gap-1 md:flex-row md:items-end md:justify-between md:gap-3">
        <p className="text-lg font-semibold tracking-tight md:text-2xl">{format(data.value)}</p>
        <Sparkline values={data.series} label={`${label} trend`} />
      </div>
      <div className="mt-1">
        <Trend value={data.change} points={points} />
      </div>
    </div>
  )
}

function MetricStrip({ data }: { data: UsageDashboardData }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-md border">
      <div className="grid grid-cols-4 md:flex">
        <Metric label="Requests" data={data.metrics.requests} format={value => wholeNumber.format(value)} />
        <Metric label="Active clients" data={data.metrics.activeClients} format={value => wholeNumber.format(value)} />
        <Metric label="Success rate" data={data.metrics.successRate} format={value => `${value.toFixed(2)}%`} points />
        <Metric label="Cache hit rate" data={data.metrics.cacheHitRate} format={value => `${value.toFixed(2)}%`} points />
      </div>
    </div>
  )
}

function niceMaximum(values: number[]) {
  const maximum = Math.max(...values, 1)
  const unit = 10 ** Math.floor(Math.log10(maximum))
  return Math.ceil(maximum / unit) * unit
}

function offsetPoints(points: string, left: number, top: number) {
  return points.split(' ').map(point => {
    const [x, y] = point.split(',').map(Number)
    return `${(x + left).toFixed(2)},${(y + top).toFixed(2)}`
  }).join(' ')
}

function RequestChart({ data }: { data: UsageDashboardData['requestsOverTime'] }) {
  const width = 720
  const height = 240
  const left = 46
  const right = 12
  const top = 12
  const bottom = 34
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maximum = niceMaximum(data.map(item => item.value))
  const normalized = data.map(item => (item.value / maximum) * plotHeight)
  const line = offsetPoints(polylinePoints(normalized, plotWidth, plotHeight), left, top)
  const area = `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}`
  const labelEvery = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div className="max-w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Requests over time chart">
        <title>Requests over time</title>
        {Array.from({ length: 5 }, (_, index) => {
          const y = top + (plotHeight / 4) * index
          const value = maximum - (maximum / 4) * index
          return (
            <g key={index}>
              <line x1={left} x2={left + plotWidth} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={left - 9} y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">
                {compactNumber.format(value)}
              </text>
            </g>
          )
        })}
        <polygon points={area} fill="var(--chart-1)" opacity="0.09" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {line.split(' ').map((point, index) => {
          if (index % labelEvery !== 0 && index !== data.length - 1) return null
          const [x, y] = point.split(',').map(Number)
          return (
            <g key={index}>
              <circle cx={x} cy={y} r="3" fill="var(--chart-1)" />
              <text x={x} y={height - 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize="11">
                {data[index]?.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TopEndpoints({ data }: { data: UsageDashboardData }) {
  const maximum = data.topEndpoints[0]?.count || 1
  return (
    <div className="min-w-0 flex flex-col gap-3">
      {data.topEndpoints.length ? data.topEndpoints.map((item, index) => (
        <div key={item.endpoint} className="grid grid-cols-[1.25rem_minmax(120px,1fr)_minmax(80px,1.4fr)_auto] items-center gap-2 text-xs">
          <span>{index + 1}</span>
          <span className="truncate" title={item.endpoint}>{item.endpoint}</span>
          <span className="h-1.5 bg-muted">
            <span className="block h-full bg-primary" style={{ width: `${percentage(item.count, maximum)}%` }} />
          </span>
          <span className="text-right tabular-nums">{wholeNumber.format(item.count)} ({item.percent.toFixed(1)}%)</span>
        </div>
      )) : (
        <p className="text-sm text-muted-foreground">No endpoint traffic yet.</p>
      )}
    </div>
  )
}

function AnalyticsList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>
}

function CountryList({ data }: { data: UsageDashboardData }) {
  return (
    <AnalyticsList>
      {data.countries.slice(0, 5).map((item, index) => (
        <div key={item.code || 'unknown'} className="grid grid-cols-[1.25rem_1fr_auto] gap-2 text-xs">
          <span>{index + 1}</span>
          <span className="truncate">{item.name}</span>
          <span className="tabular-nums">{wholeNumber.format(item.count)} ({item.percent.toFixed(1)}%)</span>
        </div>
      ))}
      {data.countries.length === 0 ? <p className="text-sm text-muted-foreground">No country data yet.</p> : null}
    </AnalyticsList>
  )
}

function StatusList({ data }: { data: UsageDashboardData }) {
  const dotClasses: Record<string, string> = {
    '2xx': 'bg-success',
    '4xx': 'bg-chart-4',
    '5xx': 'bg-destructive',
    Other: 'bg-muted-foreground',
  }
  return (
    <AnalyticsList>
      {data.statusBreakdown.map(item => (
        <div key={item.label} className="grid grid-cols-[0.5rem_1fr_auto] items-center gap-2 text-xs">
          <span className={cn('size-2 rounded-full', dotClasses[item.label])} />
          <span>{item.label}</span>
          <span className="tabular-nums">{wholeNumber.format(item.count)} ({item.percent.toFixed(1)}%)</span>
        </div>
      ))}
    </AnalyticsList>
  )
}

function KeyList({ data }: { data: UsageDashboardData }) {
  return (
    <AnalyticsList>
      {data.topApiKeys.map((item, index) => (
        <div key={`${item.id}:${item.label}:${item.prefix}`} className="grid grid-cols-[1.25rem_1fr_auto] gap-2 text-xs">
          <span>{index + 1}</span>
          <span className="truncate" title={`${item.label} ${item.prefix}`}>
            {item.label}{item.prefix ? ` · ${item.prefix}…` : ''}
          </span>
          <span className="tabular-nums">{wholeNumber.format(item.count)} ({item.percent.toFixed(1)}%)</span>
        </div>
      ))}
      {data.topApiKeys.length === 0 ? <p className="text-sm text-muted-foreground">No authenticated traffic yet.</p> : null}
    </AnalyticsList>
  )
}

function Operations({ data }: { data: UsageDashboardData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
      <div>
        <p className="text-xs text-muted-foreground">P95 latency</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{wholeNumber.format(data.metrics.p95Latency.value)} ms</p>
        <div className="mt-1"><Trend value={data.metrics.p95Latency.change} invert /></div>
      </div>
      <div className="border-t pt-4 sm:border-l sm:border-t-0 sm:pl-4 md:border-l-0 md:border-t md:pl-0">
        <p className="text-xs text-muted-foreground">Rate limited</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{wholeNumber.format(data.metrics.rateLimited.value)}</p>
        <div className="mt-1"><Trend value={data.metrics.rateLimited.change} invert /></div>
      </div>
    </div>
  )
}

function OperationMetric({
  label,
  value,
  change,
}: {
  label: string
  value: string
  change: number
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1"><Trend value={change} invert /></div>
    </div>
  )
}

function MobileAnalytics({ data }: { data: UsageDashboardData }) {
  const items = [
    { label: 'Traffic by country', value: `${data.countries.length} countries`, icon: Globe2, content: <CountryList data={data} /> },
    { label: 'Status codes', value: `${data.statusBreakdown.filter(item => item.count).length} codes`, icon: CircleDot, content: <StatusList data={data} /> },
    { label: 'Top API keys', value: `${data.topApiKeys.length} keys`, icon: Key, content: <KeyList data={data} /> },
    {
      label: 'P95 latency',
      value: `${wholeNumber.format(data.metrics.p95Latency.value)} ms`,
      icon: Clock3,
      content: (
        <OperationMetric
          label="95% of requests completed within"
          value={`${wholeNumber.format(data.metrics.p95Latency.value)} ms`}
          change={data.metrics.p95Latency.change}
        />
      ),
    },
    {
      label: 'Rate limited',
      value: wholeNumber.format(data.metrics.rateLimited.value),
      icon: ShieldAlert,
      content: (
        <OperationMetric
          label="HTTP 429 responses in this range"
          value={wholeNumber.format(data.metrics.rateLimited.value)}
          change={data.metrics.rateLimited.change}
        />
      ),
    },
  ]
  return (
    <div className="divide-y rounded-md border md:hidden">
      {items.map(item => (
        <details key={item.label} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <item.icon className="size-4" />
            <span>{item.label}</span>
            <span className="ml-auto font-normal text-muted-foreground">{item.value}</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t px-4 py-3">{item.content}</div>
        </details>
      ))}
    </div>
  )
}

function statusBadge(status: number) {
  const variant = status < 400 ? 'success' : status >= 500 ? 'destructive' : 'secondary'
  return <Badge variant={variant}>{status}</Badge>
}

function cacheBadge(cacheStatus: string | null) {
  if (!cacheStatus) return <span className="text-muted-foreground">—</span>
  return <Badge variant={cacheStatus === 'hit' ? 'success' : cacheStatus === 'miss' ? 'secondary' : 'outline'}>{cacheStatus.toUpperCase()}</Badge>
}

function apiKeyName(log: UsageDashboardData['logs'][number]) {
  if (!log.apiKeyLabel) return 'Unauthenticated'
  return `${log.apiKeyLabel}${log.apiKeyPrefix ? ` · ${log.apiKeyPrefix}…` : ''}`
}

function DesktopRequestTable({ data }: { data: UsageDashboardData }) {
  return (
    <div className="hidden md:block">
      <Table className="usage-table">
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>API key</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead>Query</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>IP address</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Cache</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.logs.map(log => (
            <TableRow key={log.id}>
              <TableCell>{dateTime.format(log.createdAt)}</TableCell>
              <TableCell className="max-w-[190px] truncate" title={apiKeyName(log)}>{apiKeyName(log)}</TableCell>
              <TableCell className="max-w-[260px] truncate" title={log.endpoint}>{log.endpoint}</TableCell>
              <TableCell className="max-w-[240px] truncate" title={log.query}>{log.query || '—'}</TableCell>
              <TableCell>{statusBadge(log.status)}</TableCell>
              <TableCell>{log.ipAddress}</TableCell>
              <TableCell>{countryName(log.countryCode)}</TableCell>
              <TableCell className="text-right tabular-nums">{log.durationMs} ms</TableCell>
              <TableCell>{cacheBadge(log.cacheStatus)}</TableCell>
            </TableRow>
          ))}
          {data.logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No API requests match these filters.</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

function MobileRequestList({ data }: { data: UsageDashboardData }) {
  return (
    <div className="divide-y md:hidden">
      <div className="grid grid-cols-[1rem_5rem_4rem_minmax(0,1fr)_auto] gap-2 px-3 py-2 text-xs font-medium">
        <span />
        <span>Time</span>
        <span>Status</span>
        <span>Endpoint</span>
        <span>Cache</span>
      </div>
      {data.logs.map(log => (
        <details key={log.id} className="group">
          <summary className="grid cursor-pointer list-none grid-cols-[1rem_5rem_4rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-xs [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
            <span>{timeOnly.format(log.createdAt)}</span>
            <span>{statusBadge(log.status)}</span>
            <span className="truncate" title={log.endpoint}>{log.endpoint}</span>
            <span>{cacheBadge(log.cacheStatus)}</span>
          </summary>
          <dl className="mx-3 mb-3 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-md border bg-muted/20 p-3 text-xs">
            <dt>API key</dt><dd className="truncate" title={apiKeyName(log)}>{apiKeyName(log)}</dd>
            <dt>Query</dt><dd className="break-all">{log.query || '—'}</dd>
            <dt>IP address</dt><dd>{log.ipAddress}</dd>
            <dt>Country</dt><dd>{countryName(log.countryCode)}</dd>
            <dt>Duration</dt><dd>{log.durationMs} ms</dd>
            <dt>Cache</dt><dd>{cacheBadge(log.cacheStatus)}</dd>
          </dl>
        </details>
      ))}
      {data.logs.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">No API requests match these filters.</p> : null}
    </div>
  )
}

function pageHref(data: UsageDashboardData, page: number) {
  const params = new URLSearchParams()
  if (data.range !== '24h') params.set('range', data.range)
  if (data.filters.search) params.set('search', data.filters.search)
  if (data.filters.status !== 'all') params.set('status', data.filters.status)
  if (data.filters.country !== 'all') params.set('country', data.filters.country)
  if (page > 1) params.set('page', String(page))
  return `/admin/usage${params.size ? `?${params}` : ''}`
}

function pageItems(current: number, total: number) {
  const pages = [...new Set([1, 2, current - 1, current, current + 1, total])]
    .filter(page => page > 0 && page <= total)
    .sort((a, b) => a - b)
  const items: Array<number | 'ellipsis'> = []
  for (const page of pages) {
    if (items.length && typeof items.at(-1) === 'number' && page - Number(items.at(-1)) > 1) items.push('ellipsis')
    items.push(page)
  }
  return items
}

function Pagination({ data }: { data: UsageDashboardData }) {
  const { page, pageSize, total, totalPages } = data.pagination
  const start = total ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
      <p>Showing {wholeNumber.format(start)} to {wholeNumber.format(end)} of {wholeNumber.format(total)} requests</p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Button variant="outline" size="icon" asChild>
            <Link href={pageHref(data, page - 1)} aria-label="Previous page"><ArrowLeft /></Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label="Previous page"><ArrowLeft /></Button>
        )}
        {pageItems(page, totalPages).map((item, index) => item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2">…</span>
        ) : (
          <Button key={item} variant={item === page ? 'default' : 'outline'} size="icon" asChild>
            <Link href={pageHref(data, item)} aria-label={`Page ${item}`} aria-current={item === page ? 'page' : undefined}>{item}</Link>
          </Button>
        ))}
        {page < totalPages ? (
          <Button variant="outline" size="icon" asChild>
            <Link href={pageHref(data, page + 1)} aria-label="Next page"><ArrowRight /></Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label="Next page"><ArrowRight /></Button>
        )}
      </div>
    </div>
  )
}

export function UsageDashboard({ data }: { data: UsageDashboardData }) {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage & Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor API traffic, clients, performance, and recent requests.</p>
        </div>
        <UsageRangeControls range={data.range} />
      </header>

      <MetricStrip data={data} />

      <div className="grid min-w-0 gap-3 lg:grid-cols-[1.6fr_1fr]">
        <section className="min-w-0 rounded-md border p-4">
          <h2 className="mb-2 text-sm font-semibold">Requests over time</h2>
          <RequestChart data={data.requestsOverTime} />
        </section>
        <section className="min-w-0 rounded-md border p-4">
          <h2 className="mb-4 text-sm font-semibold">Top endpoints</h2>
          <TopEndpoints data={data} />
        </section>
      </div>

      <div className="hidden grid-cols-[1fr_0.9fr_1.25fr_0.9fr] divide-x rounded-md border md:grid">
        <section className="p-4"><h2 className="mb-3 text-sm font-semibold">Traffic by country</h2><CountryList data={data} /></section>
        <section className="p-4"><h2 className="mb-3 text-sm font-semibold">Status codes</h2><StatusList data={data} /></section>
        <section className="p-4"><h2 className="mb-3 text-sm font-semibold">Top API keys</h2><KeyList data={data} /></section>
        <section className="p-4"><Operations data={data} /></section>
      </div>
      <MobileAnalytics data={data} />

      <section className="min-w-0 overflow-hidden rounded-md border">
        <div className="border-b px-4 py-3">
          <h2 className="mb-2 text-sm font-semibold">Recent requests</h2>
          <UsageFilters
            key={`${data.filters.search}:${data.filters.status}:${data.filters.country}`}
            search={data.filters.search}
            status={data.filters.status}
            country={data.filters.country}
            countries={data.countries.map(item => ({ code: item.code, name: item.name }))}
          />
        </div>
        <DesktopRequestTable data={data} />
        <MobileRequestList data={data} />
        <Pagination data={data} />
      </section>
    </div>
  )
}
