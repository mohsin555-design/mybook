import { CloudCheckIcon, Loading03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { cn } from '../../lib/utils'
import type { EditorSaveStatus } from '../../types/files'

type EditorStatusWorkspace = 'local' | 'drive'

function editorStatusLabel(status: EditorSaveStatus, workspace: EditorStatusWorkspace) {
  if (status === 'editing' || status === 'saving-locally') return 'Saving…'
  if (workspace === 'local') {
    if (status === 'failed') return "Couldn't save"
    return 'Saved'
  }
  if (status === 'saved-locally' || status === 'pending') return 'Saved locally'
  if (status === 'backing-up') return 'Syncing…'
  if (status === 'backed-up') return 'Synced'
  if (status === 'failed') return 'Saved locally · Sync failed'
  if (status === 'offline') return 'Saved locally · Offline'
  return 'Saved'
}

export function EditorStatus({
  status,
  workspace = 'drive',
  onRetry,
}: {
  status: EditorSaveStatus
  workspace?: EditorStatusWorkspace
  onRetry?: () => void
}) {
  const label = editorStatusLabel(status, workspace)
  const isSaving = status === 'editing' || status === 'saving-locally' || status === 'backing-up'

  if (status === 'failed' && onRetry) {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-label={`Editor status: ${label}`}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <HugeiconsIcon icon={CloudCheckIcon} strokeWidth={2} className="size-4 text-destructive" />
        <span className="hidden md:inline">{label}</span>
        <span className="hidden md:inline" aria-hidden="true">·</span>
        <button
          type="button"
          onClick={onRetry}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Retry
        </button>
      </span>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Editor status: ${label}`}
      className="flex h-7 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
    >
      <HugeiconsIcon
        icon={isSaving ? Loading03Icon : CloudCheckIcon}
        strokeWidth={2}
        className={cn('size-4', isSaving && 'animate-spin')}
      />
      <span className="hidden md:inline">{label}</span>
    </div>
  )
}
