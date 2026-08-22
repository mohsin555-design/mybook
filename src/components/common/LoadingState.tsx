import { Skeleton } from '../ui/skeleton'

interface LoadingStateProps {
  label?: string
  rows?: number
}

export function LoadingState({ label = 'Loading content', rows = 3 }: LoadingStateProps) {
  return (
    <section aria-label={label} aria-busy="true" role="status" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-card-foreground">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="h-3 w-1/3 rounded-md" />
          </div>
        </div>
      ))}
    </section>
  )
}
