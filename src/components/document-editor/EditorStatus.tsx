import { ArrowPathIcon, CheckCircleIcon, CloudArrowUpIcon, ExclamationCircleIcon, PencilIcon, SignalSlashIcon } from '@heroicons/react/20/solid'

import type { EditorSaveStatus } from '../../types/files'

const config = {
  editing: ['Editing', PencilIcon],
  'saving-locally': ['Saving locally', ArrowPathIcon],
  'saved-locally': ['Saved locally', CheckCircleIcon],
  pending: ['Backup pending', CloudArrowUpIcon],
  'backing-up': ['Backing up', ArrowPathIcon],
  'backed-up': ['Backed up', CheckCircleIcon],
  failed: ['Backup failed', ExclamationCircleIcon],
  offline: ['Offline', SignalSlashIcon],
} as const

export function EditorStatus({ status }: { status: EditorSaveStatus }) {
  const [label, Icon] = config[status]
  return <span role="status" aria-live="polite" aria-label={`Editor status: ${label}`} className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted"><Icon aria-hidden="true" className={`size-4 ${status === 'saving-locally' || status === 'backing-up' ? 'animate-spin' : ''}`} />{label}</span>
}
