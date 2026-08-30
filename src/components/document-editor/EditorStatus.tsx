import type { EditorSaveStatus } from '../../types/files'

const config = {
  editing: 'Saving...',
  'saving-locally': 'Saving...',
  'saved-locally': 'Saved',
  local: 'Saved',
  pending: 'Saved',
  'backing-up': 'Saving...',
  'backed-up': 'Saved',
  failed: "Couldn't sync",
  offline: 'Offline - changes saved locally',
} as const

export function EditorStatus({ status, onRetry }: { status: EditorSaveStatus; onRetry?: () => void }) {
  const label = config[status]
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
