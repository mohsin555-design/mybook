import type { ReactNode } from 'react'

interface FolderCardProps {
  name: string
  itemCount: number
  driveStatus?: ReactNode
  onOpen?: () => void
  action?: ReactNode
}

export function FolderCard({ name, itemCount, driveStatus, onOpen, action }: FolderCardProps) {
  return (
    <article className="flex min-h-[60px] items-center gap-3 border-b border-[var(--app-border)] px-3 py-2 transition-colors hover:bg-[var(--app-subtle)]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left">
        <span className="flex size-9 shrink-0 items-center justify-center">
          <img src="/icons/folder.svg" alt="" aria-hidden="true" className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-5">{name}</span>
          <span className="block text-xs leading-4 text-muted">{itemCount} {itemCount === 1 ? 'file' : 'files'}</span>
          {driveStatus ? <span className="sr-only">{driveStatus}</span> : null}
        </span>
      </button>
      {action}
    </article>
  )
}
