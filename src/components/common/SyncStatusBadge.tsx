import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/20/solid'

import type { SyncStatus } from '../../types/files'
import { Badge } from '../ui/badge'

interface SyncStatusBadgeProps {
  status: SyncStatus
}

const statusConfig = {
  pending: { label: 'Syncing', className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300', icon: ArrowPathIcon },
  'backing-up': { label: 'Syncing', className: 'bg-primary/10 text-primary', icon: ArrowPathIcon },
  'backed-up': { label: 'Synced', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: CheckCircleIcon },
  failed: { label: 'Sync paused', className: 'bg-destructive/10 text-destructive', icon: ExclamationCircleIcon },
  offline: { label: 'Offline', className: 'bg-muted text-muted-foreground', icon: ExclamationCircleIcon },
} as const

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge role="status" aria-label={config.label} variant="secondary" className={`inline-flex min-h-7 items-center gap-1 rounded-xl px-2 text-sm ${config.className}`}>
      <Icon aria-hidden="true" className={`size-4 ${status === 'backing-up' ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </Badge>
  )
}
