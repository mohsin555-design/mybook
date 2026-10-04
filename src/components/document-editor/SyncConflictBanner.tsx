import { Button } from '../ui/button'

interface SyncConflictBannerProps {
  onKeepMine: () => void
  onUseRemote: () => void
}

export function SyncConflictBanner({ onKeepMine, onUseRemote }: SyncConflictBannerProps) {
  return (
    <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-subtle)] px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">This document was also changed on another device. Your edits are kept; the other version is saved in history.</span>
      <Button type="button" size="sm" variant="outline" onClick={onKeepMine}>Keep mine</Button>
      <Button type="button" size="sm" variant="outline" onClick={onUseRemote}>Use other version</Button>
    </div>
  )
}
