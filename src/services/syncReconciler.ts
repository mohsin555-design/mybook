import type { SyncStatus } from '../types/files'

export interface ReconcileInput {
  /** Last content known to match the remote copy. `undefined` for files created before base tracking existed. */
  baseContent: string | null | undefined
  /** Content persisted locally. */
  localContent: string
  syncStatus: SyncStatus
  /** Keystrokes or autosave changes that have not reached the local store yet. */
  hasUnsavedLocalEdits: boolean
  /** Local changes (content, rename, move) queued but not yet pushed to the remote. */
  hasPendingPush?: boolean
  /** Remote version is newer than the version the local base was taken from. */
  remoteChanged: boolean
  remoteContent: string
}

export type ReconcileDecision =
  | { action: 'noop' }
  | { action: 'keep-local' }
  | { action: 'apply-remote' }
  | { action: 'conflict' }

export function hasLocalChanges(input: Pick<ReconcileInput, 'baseContent' | 'localContent' | 'syncStatus' | 'hasUnsavedLocalEdits' | 'hasPendingPush'>) {
  if (input.hasUnsavedLocalEdits || input.hasPendingPush) return true
  // Unknown base: only a fully backed-up file is known to equal its remote copy.
  if (input.baseContent === undefined || input.baseContent === null) return input.syncStatus !== 'backed-up'
  return input.localContent !== input.baseContent
}

// Remote content may only replace local content when local is provably
// unchanged since the base. Anything uncertain is treated as a local change.
export function reconcileExternalUpdate(input: ReconcileInput): ReconcileDecision {
  if (!input.remoteChanged) return { action: 'noop' }
  if (!input.hasUnsavedLocalEdits && input.remoteContent === input.localContent) return { action: 'noop' }
  if (!hasLocalChanges(input)) return { action: 'apply-remote' }
  return { action: 'conflict' }
}
