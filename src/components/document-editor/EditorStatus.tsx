import { ArrowPathIcon, CheckCircleIcon, CloudArrowUpIcon, ExclamationCircleIcon, PencilIcon, SignalSlashIcon } from '@heroicons/react/20/solid'

import type { EditorSaveStatus } from '../../types/files'

const config = {
  editing: ['Editing', PencilIcon],
  'saving-locally': ['Saving', ArrowPathIcon],
  'saved-locally': ['Saved', CheckCircleIcon],
  pending: ['Syncing', CloudArrowUpIcon],
  'backing-up': ['Syncing', ArrowPathIcon],
  'backed-up': ['Synced', CheckCircleIcon],
  failed: ['Sync paused', ExclamationCircleIcon],
  offline: ['Offline', SignalSlashIcon],
} as const

export function EditorStatus({ status }: { status: EditorSaveStatus }) {
  const [label, Icon] = config[status]
  return <span role="status" aria-live="polite" aria-label={`Editor status: ${label}`} className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground"><Icon aria-hidden="true" className={`size-4 ${status === 'saving-locally' || status === 'backing-up' ? 'animate-spin' : ''}`} />{label}</span>
}
