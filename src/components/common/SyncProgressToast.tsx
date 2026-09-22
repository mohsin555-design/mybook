import { CloudUploadIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export interface SyncProgressToastProps {
  isVisible?: boolean
  title?: string
  subtitle?: string
  progress?: number
}

export function SyncProgressToast({
  isVisible = false,
  title = 'Fetching your data…',
  subtitle,
  progress = 0,
}: SyncProgressToastProps) {
  if (!isVisible) return null

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)))
  const displaySubtitle = subtitle ?? `${clampedProgress}%`

  return (
    <aside
      aria-label="Data synchronization status"
      aria-live="polite"
      role="status"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="pointer-events-none fixed z-50 transition-all duration-300 ease-out bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 right-4 sm:bottom-auto sm:top-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-80"
    >
      <div className="pointer-events-auto relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-popover/95 p-3.5 shadow-xl backdrop-blur-md dark:border-border">
        <div className="flex items-center gap-3">
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{displaySubtitle}</p>
          </div>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>
    </aside>
  )
}

