import { FolderIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'

interface FolderCardProps {
  name: string
  itemCount: number
  onOpen?: () => void
  action?: ReactNode
}

export function FolderCard({ name, itemCount, onOpen, action }: FolderCardProps) {
  return (
    <article className="app-surface flex min-h-24 items-center gap-2 rounded-xl p-3 transition-colors hover:bg-[var(--app-subtle)]">
      <button type="button" onClick={onOpen} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left">
        <FolderIcon aria-hidden="true" className="size-7 shrink-0 text-warning" />
        <span className="min-w-0">
          <span className="block truncate text-base font-medium leading-6">{name}</span>
          <span className="block text-sm leading-5 text-muted">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
        </span>
      </button>
      {action}
    </article>
  )
}
