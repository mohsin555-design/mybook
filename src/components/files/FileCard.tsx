import type { ReactNode } from 'react'

import type { FileType, SyncStatus } from '../../types/files'

interface FileCardProps {
  name: string
  meta: string
  type?: FileType
  syncStatus?: SyncStatus
  folderName?: string
  onOpen?: () => void
  action?: ReactNode
}

export function FileCard({
  name,
  meta,
  type = 'document',
  onOpen,
  action,
}: FileCardProps) {
  const iconSrc = type === 'spreadsheet' ? '/icons/sheet.svg' : '/icons/file.svg'

  return (
    <article className="flex min-h-[60px] items-center gap-3 border-b border-[var(--app-border)] px-3 py-2 transition-colors hover:bg-[var(--app-subtle)]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left">
        <span className="flex size-9 shrink-0 items-center justify-center text-foreground">
          <img src={iconSrc} alt="" aria-hidden="true" className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium leading-5">{name}</span>
          <span className="block truncate text-xs leading-4 text-muted">{meta}</span>
        </span>
      </button>
      {action}
    </article>
  )
}
