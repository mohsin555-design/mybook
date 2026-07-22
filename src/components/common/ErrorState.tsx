import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'

interface ErrorStateProps {
  title?: string
  message: string
  action?: ReactNode
}

export function ErrorState({ title = 'Something went wrong', message, action }: ErrorStateProps) {
  return (
    <section role="alert" className="rounded-xl border border-danger/40 bg-danger-soft p-4 text-danger-soft-foreground">
      <div className="flex gap-3">
        <ExclamationTriangleIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="text-lg font-semibold leading-7">{title}</h2>
          <p className="mt-1 text-base leading-7">{message}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </section>
  )
}
