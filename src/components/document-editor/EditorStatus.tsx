import type { EditorSaveStatus } from '../../types/files'

type EditorStatusWorkspace = 'local' | 'drive'

function editorStatusLabel(status: EditorSaveStatus, workspace: EditorStatusWorkspace) {
  if (status === 'editing' || status === 'saving-locally') return 'Saving...'
  if (workspace === 'local') {
    if (status === 'failed') return "Couldn't save"
    return 'Saved'
  }
  if (status === 'saved-locally' || status === 'pending') return 'Saved locally'
  if (status === 'backing-up') return 'Syncing...'
  if (status === 'backed-up') return 'Synced'
  if (status === 'failed') return 'Saved locally · Sync failed'
  if (status === 'offline') return 'Saved locally · Offline'
  return 'Saved'
}

export function EditorStatus({ status, workspace = 'drive', onRetry }: { status: EditorSaveStatus; workspace?: EditorStatusWorkspace; onRetry?: () => void }) {
  const label = editorStatusLabel(status, workspace)
  if (status === 'failed' && onRetry) {
    return (
      <span role="status" aria-live="polite" aria-label={`Editor status: ${label}`} className="inline-flex min-h-7 items-center gap-1.5 text-sm text-muted-foreground">
        <span>{label}</span>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onRetry} className="font-medium text-foreground underline-offset-4 hover:underline">
          Retry
        </button>
      </span>
    )
  }

  return <span role="status" aria-live="polite" aria-label={`Editor status: ${label}`} className="inline-flex min-h-7 items-center text-sm text-muted-foreground">{label}</span>
}
