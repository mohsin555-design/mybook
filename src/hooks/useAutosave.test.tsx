// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { recordRemoteConflict } from '../services/syncConflicts'
import type { MyBookFile } from '../types/files'
import { useAutosave } from './useAutosave'

vi.mock('../database/repositories', () => ({ fileRepository: { update: vi.fn().mockResolvedValue({ success: true }) } }))
vi.mock('../services/syncConflicts', () => ({ recordRemoteConflict: vi.fn().mockResolvedValue(null) }))
vi.mock('../stores/useWorkspaceStore', () => ({ isLocalWorkspace: () => false }))

const file = (content: string): MyBookFile => ({
  id: 'file-1', driveFileId: 'drive-1', name: 'Doc', type: 'document', folderId: null, content, mimeType: 'x',
  createdAt: '', updatedAt: '', lastSyncedAt: '2026-10-03T12:00:00.000Z', syncStatus: 'backed-up', isDeleted: false,
})

describe('useAutosave external updates', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('adopts incoming content when there are no unsaved edits', () => {
    const { result, rerender } = renderHook(({ f }) => useAutosave(f), { initialProps: { f: file('a') } })
    rerender({ f: file('b') })
    expect(result.current.content).toBe('b')
    expect(recordRemoteConflict).not.toHaveBeenCalled()
  })

  it('keeps unsaved edits and records the incoming content as a conflict', () => {
    const { result, rerender } = renderHook(({ f }) => useAutosave(f), { initialProps: { f: file('a') } })
    act(() => result.current.setContent('typed locally'))
    expect(result.current.hasUnsavedChanges()).toBe(true)

    rerender({ f: file('remote') })

    expect(result.current.content).toBe('typed locally')
    expect(recordRemoteConflict).toHaveBeenCalledWith('file-1', 'remote', '2026-10-03T12:00:00.000Z')
  })
})
