export const dynamic = 'force-dynamic'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getApiKeys } from '@/app/actions/db'
import { KeyForm } from '@/components/admin/key-form'
import { KeyActions } from '@/components/admin/key-actions'

export default async function KeysPage() {
  const keys = await getApiKeys()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">API Keys</h2>
        <KeyForm />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded truncate max-w-[200px]">
                    {key.key.slice(0, 12)}...
                  </code>
                </div>
              </TableCell>
              <TableCell>{key.label}</TableCell>
              <TableCell>
                <Badge variant={key.active ? 'default' : 'secondary'}>
                  {key.active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(key.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <KeyActions
                  keyId={key.id}
                  key={key.key}
                  active={key.active}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
