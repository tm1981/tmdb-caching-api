export const dynamic = 'force-dynamic'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Film, Tv } from 'lucide-react'
import { getSyncLogs } from '@/app/actions/db'
import { SyncButtons } from '@/components/admin/sync-buttons'

export default async function SyncPage() {
  const logs = await getSyncLogs(50)

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Sync</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="size-5" />
              Trending Movies
            </CardTitle>
            <CardDescription>
              Sync today's trending movies from TMDB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncButtons type="trending-movies" label="Sync Trending Movies" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="size-5" />
              Trending TV Shows
            </CardTitle>
            <CardDescription>
              Sync today's trending TV shows from TMDB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncButtons type="trending-tv" label="Sync Trending TV" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="size-5" />
              Top Rated Movies
            </CardTitle>
            <CardDescription>
              Sync top rated movies from TMDB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncButtons type="top-rated-movies" label="Sync Top Rated Movies" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="size-5" />
              Top Rated TV Shows
            </CardTitle>
            <CardDescription>
              Sync top rated TV shows from TMDB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncButtons type="top-rated-tv" label="Sync Top Rated TV" />
          </CardContent>
        </Card>
      </div>

      <h3 className="text-lg font-semibold mb-4">Sync Logs</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <Badge variant="secondary">{log.type}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                  {log.status}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[400px] truncate">{log.detail}</TableCell>
              <TableCell>
                {new Date(log.createdAt).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No sync logs yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
