import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/20/solid'
import { Badge } from '@heroui/react'

import type { SyncStatus } from '../../types/files'

interface SyncStatusBadgeProps {
  status: SyncStatus
}

const statusConfig = {
  pending: { label: 'Backup pending', color: 'warning', icon: ArrowPathIcon },
  'backing-up': { label: 'Backing up', color: 'accent', icon: ArrowPathIcon },
  'backed-up': { label: 'Backed up', color: 'success', icon: CheckCircleIcon },
  failed: { label: 'Backup failed', color: 'danger', icon: ExclamationCircleIcon },
  offline: { label: 'Offline', color: 'default', icon: ExclamationCircleIcon },
} as const

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge role="status" aria-label={config.label} color={config.color} variant="soft" className="inline-flex min-h-7 items-center gap-1 rounded-lg px-2 text-sm">
      <Icon aria-hidden="true" className={`size-4 ${status === 'backing-up' ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </Badge>
  )
}
