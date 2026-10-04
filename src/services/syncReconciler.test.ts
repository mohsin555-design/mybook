import { describe, expect, it } from 'vitest'

import { reconcileExternalUpdate, type ReconcileInput } from './syncReconciler'

const input = (overrides: Partial<ReconcileInput> = {}): ReconcileInput => ({
  baseContent: 'base',
  localContent: 'base',
  syncStatus: 'backed-up',
  hasUnsavedLocalEdits: false,
  remoteChanged: true,
  remoteContent: 'remote',
  ...overrides,
})

describe('reconcileExternalUpdate', () => {
  it('does nothing when the remote has not changed', () => {
    expect(reconcileExternalUpdate(input({ remoteChanged: false, localContent: 'mine' }))).toEqual({ action: 'noop' })
  })

  it('applies the remote only when local is unchanged since the base', () => {
    expect(reconcileExternalUpdate(input())).toEqual({ action: 'apply-remote' })
  })

  it('flags a conflict when both sides changed', () => {
    expect(reconcileExternalUpdate(input({ localContent: 'mine' }))).toEqual({ action: 'conflict' })
  })

  it('never applies the remote over unsaved keystrokes, even if stored content equals the base', () => {
    expect(reconcileExternalUpdate(input({ hasUnsavedLocalEdits: true }))).toEqual({ action: 'conflict' })
  })

  it('never applies the remote over a queued push', () => {
    expect(reconcileExternalUpdate(input({ hasPendingPush: true }))).toEqual({ action: 'conflict' })
  })

  it('adopts identical content without a conflict', () => {
    expect(reconcileExternalUpdate(input({ localContent: 'same', remoteContent: 'same' }))).toEqual({ action: 'noop' })
  })

  it('still reports a conflict for identical content while edits are unsaved', () => {
    expect(reconcileExternalUpdate(input({ localContent: 'same', remoteContent: 'same', hasUnsavedLocalEdits: true }))).toEqual({ action: 'conflict' })
  })

  describe('files created before base tracking', () => {
    it('applies the remote for a backed-up file', () => {
      expect(reconcileExternalUpdate(input({ baseContent: undefined }))).toEqual({ action: 'apply-remote' })
    })

    it.each(['pending', 'failed', 'offline'] as const)('is conservative for a %s file', (syncStatus) => {
      expect(reconcileExternalUpdate(input({ baseContent: undefined, syncStatus }))).toEqual({ action: 'conflict' })
    })
  })
})
