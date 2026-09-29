// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useLocalMirrorSync } from './useLocalMirrorSync'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import * as localWorkspace from '../services/localWorkspace'

describe('useLocalMirrorSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({ isMirrorFolderMissing: false, workspaceRevision: 0 })
  })

  afterEach(() => {
    cleanup()
  })

  it('sets isMirrorFolderMissing to true if handle validity check fails with NotFoundError', async () => {
    vi.spyOn(localWorkspace, 'checkDeviceDirectoryHandleValid').mockResolvedValue({
      valid: false,
      handle: null,
      error: 'NotFoundError',
    })

    renderHook(() => useLocalMirrorSync())

    await waitFor(() => {
      expect(useWorkspaceStore.getState().isMirrorFolderMissing).toBe(true)
    })
  })

  it('keeps isMirrorFolderMissing false when directory handle is waiting for permission (prompt)', async () => {
    const fakeHandle = { name: 'MockDir', kind: 'directory' } as unknown as FileSystemDirectoryHandle
    vi.spyOn(localWorkspace, 'checkDeviceDirectoryHandleValid').mockResolvedValue({
      valid: true,
      handle: fakeHandle,
      needsPermission: true,
    })
    vi.spyOn(localWorkspace, 'hasReadWritePermission').mockResolvedValue(false)
    const forgetSpy = vi.spyOn(localWorkspace, 'forgetDeviceDirectoryHandle')

    renderHook(() => useLocalMirrorSync())

    await new Promise((r) => setTimeout(r, 50))
    expect(useWorkspaceStore.getState().isMirrorFolderMissing).toBe(false)
    expect(forgetSpy).not.toHaveBeenCalled()
  })

  it('scans and bumps workspaceRevision if files were restored/discovered', async () => {
    const fakeHandle = { name: 'MockDir', kind: 'directory' } as unknown as FileSystemDirectoryHandle
    vi.spyOn(localWorkspace, 'checkDeviceDirectoryHandleValid').mockResolvedValue({
      valid: true,
      handle: fakeHandle,
    })
    vi.spyOn(localWorkspace, 'hasReadWritePermission').mockResolvedValue(true)
    vi.spyOn(localWorkspace, 'scanAndHydrateLocalWorkspace').mockResolvedValue({
      discoveredCount: 1,
      restoredCount: 1,
    })

    const initialRevision = useWorkspaceStore.getState().workspaceRevision
    renderHook(() => useLocalMirrorSync())

    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspaceRevision).toBeGreaterThan(initialRevision)
    })
  })

  it('triggers scan on window focus event', async () => {
    const fakeHandle = { name: 'MockDir', kind: 'directory' } as unknown as FileSystemDirectoryHandle
    vi.spyOn(localWorkspace, 'checkDeviceDirectoryHandleValid').mockResolvedValue({
      valid: true,
      handle: fakeHandle,
    })
    vi.spyOn(localWorkspace, 'hasReadWritePermission').mockResolvedValue(true)
    const scanSpy = vi.spyOn(localWorkspace, 'scanAndHydrateLocalWorkspace').mockResolvedValue({
      discoveredCount: 0,
      restoredCount: 0,
    })

    renderHook(() => useLocalMirrorSync())

    await waitFor(() => {
      expect(scanSpy).toHaveBeenCalled()
    })

    // Advance time beyond debounce
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => {
      expect(scanSpy).toHaveBeenCalledTimes(2)
    })
  })
})
