import { cn } from '@/lib/utils'
import { Spinner } from '../ui/spinner'

export interface LoadingOverlayProps {
  message?: string
  className?: string
  fullScreen?: boolean
}

export function LoadingOverlay({
  message = 'Loading…',
  className,
  fullScreen = true,
}: LoadingOverlayProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 bg-white/80 p-6 text-center backdrop-blur-sm dark:bg-background/80',
        fullScreen ? 'fixed inset-0 z-50' : 'size-full min-h-48 flex-1',
        className,
      )}
    >
      <Spinner aria-hidden="true" role="presentation" className="size-7 text-primary" />
      {message ? (
        <p className="text-sm font-medium tracking-tight text-foreground">{message}</p>
      ) : null}
    </div>
  )
}
