import type { ReactNode } from 'react'

interface FolderCardProps {
  name: string
  fileCount: number
  folderCount: number
  driveStatus?: ReactNode
  onOpen?: () => void
  action?: ReactNode
}

function formatFolderContents(fileCount: number, folderCount: number) {
  const parts = []
  if (fileCount > 0) parts.push(`${fileCount} ${fileCount === 1 ? 'file' : 'files'}`)
  if (folderCount > 0) parts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`)
  return parts.length ? parts.join(', ') : 'Empty'
}

export function FolderCard({ name, fileCount, folderCount, driveStatus, onOpen, action }: FolderCardProps) {
  const contentsLabel = formatFolderContents(fileCount, folderCount)

  return (
    <article className="flex min-h-[60px] items-center gap-3 border-b border-[var(--app-border)] px-3 py-2 transition-colors hover:bg-[var(--app-subtle)]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left">
        <span className="flex size-9 shrink-0 items-center justify-center">
          <img src="/icons/folder.svg" alt="" aria-hidden="true" className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-5">{name}</span>
          <span className="block text-xs leading-4 text-muted-foreground">{contentsLabel}</span>
          {driveStatus ? <span className="sr-only">{driveStatus}</span> : null}
        </span>
      </button>
      {action}
    </article>
  )
}
