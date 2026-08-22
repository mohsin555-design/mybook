import { DocumentPlusIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center px-4 py-10 text-center" aria-labelledby="empty-state-title">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <DocumentPlusIcon aria-hidden="true" className="size-6" />
      </div>
      <h2 id="empty-state-title" className="text-lg font-semibold leading-7">{title}</h2>
      <p className="mt-1 max-w-sm text-base leading-7 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  )
}
