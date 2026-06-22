'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { toggleApiKey, deleteApiKey } from '@/app/actions/db'

interface KeyActionsProps {
  keyId: number
  key: string
  active: boolean
  showToggle?: boolean
  showDelete?: boolean
}

export function KeyActions({
  keyId,
  key,
  active,
  showToggle,
  showDelete,
}: KeyActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard')
  }

  const handleToggle = async () => {
    await toggleApiKey(keyId)
    toast.success('Key status updated')
    window.location.reload()
  }

  const handleDelete = async () => {
    if (isDeleting) {
      await deleteApiKey(keyId)
      toast.success('Key deleted')
      window.location.reload()
    } else {
      setIsDeleting(true)
      setTimeout(() => setIsDeleting(false), 3000)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        onClick={handleCopy}
        title="Copy key"
      >
        <Copy className="size-3" />
      </Button>
      {showToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={handleToggle}
          title={active ? 'Deactivate' : 'Activate'}
        >
          {active ? (
            <ToggleLeft className="size-4" />
          ) : (
            <ToggleRight className="size-4" />
          )}
        </Button>
      )}
      {showDelete && (
        <Button
          variant="ghost"
          size="icon"
          className={`size-6 ${
            isDeleting ? 'text-destructive' : 'text-muted-foreground'
          }`}
          onClick={handleDelete}
          title={isDeleting ? 'Click again to confirm' : 'Delete key'}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  )
}
