'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Copy } from 'lucide-react'
import { createApiKey } from '@/app/actions/db'

export function KeyForm() {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!label.trim()) {
      toast.error('Label is required')
      return
    }

    const key = await createApiKey(label)
    setNewKey(key.key)
    setLabel('')
    toast.success('API key created! Save it now - it won\'t be shown again.')
  }

  const handleCopy = async (key: string) => {
    await navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          New Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for accessing the TMDB service.
          </DialogDescription>
        </DialogHeader>

        {newKey ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-mono break-all">{newKey}</p>
            </div>
            <Button
              onClick={() => handleCopy(newKey)}
              className="w-full"
              variant="secondary"
            >
              <Copy className="size-4 mr-2" />
              Copy to Clipboard
            </Button>
            <Button
              onClick={() => {
                setNewKey(null)
                setLabel('')
                setOpen(false)
                window.location.reload()
              }}
              className="w-full"
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Production, Development"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Key</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
