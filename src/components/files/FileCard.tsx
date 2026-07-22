import {
  DocumentTextIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'

import type { FileType, SyncStatus } from '../../types/files'
import { SyncStatusBadge } from '../common/SyncStatusBadge'

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
  syncStatus,
  folderName = 'MyBook',
  onOpen,
  action,
}: FileCardProps) {
  const FileIcon = type === 'spreadsheet' ? TableCellsIcon : DocumentTextIcon
  const typeLabel = type === 'spreadsheet' ? 'Spreadsheet' : 'Document'

  return (
    <article className="app-surface flex min-h-20 items-center gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--app-subtle)]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
          <FileIcon aria-hidden="true" className="size-6" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-medium leading-6">{name}</span>
          <span className="block truncate text-sm leading-5 text-muted">
            {typeLabel} · {meta}
          </span>
          <span className="block truncate text-sm leading-5 text-muted">{folderName}</span>
        </span>
      </button>
      {syncStatus ? <SyncStatusBadge status={syncStatus} /> : null}
      {action}
    </article>
  )
}
