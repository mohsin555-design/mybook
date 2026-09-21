// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDriveBootstrap } from './useDriveBootstrap'

const mocks = vi.hoisted(() => ({
  mode: 'drive',
  ensure: vi.fn(),
  folders: vi.fn(),
  files: vi.fn(),
  process: vi.fn(),
  queue: vi.fn(),
  backfill: vi.fn(),
}))

vi.mock('../stores/useAuthStore', () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ isAuthenticated: true, email: 'writer@example.com' }) }))
vi.mock('../stores/useWorkspaceStore', () => ({ useWorkspaceStore: (select: (value: unknown) => unknown) => select({ mode: mocks.mode }) }))
vi.mock('../services/googleDrive', () => ({
  ensureMyBookDriveFolder: mocks.ensure,
  importDriveFoldersToLocal: mocks.folders,
  importDriveFilesToLocal: mocks.files,
  backfillLocalFoldersToDrive: mocks.backfill,
}))
vi.mock('../database/repositories', () => ({
  folderRepository: { list: vi.fn(async () => []) },
  settingsRepository: { get: vi.fn(async () => ({ data: { value: true } })), update: vi.fn() },
  processPendingDriveFolderSync: mocks.process,
  queueLocalItemsForDriveBackup: mocks.queue,
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.mode = 'drive'
  mocks.ensure.mockResolvedValue({ success: true, folderId: 'same-root', folderName: 'Writin', created: false })
})
afterEach(cleanup)

describe('Drive bootstrap migration', () => {
  it('runs root preparation before importing or queuing existing work', async () => {
    const { result } = renderHook(useDriveBootstrap)
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce())
    expect(result.current.folderId).toBe('same-root')
    expect(mocks.ensure).toHaveBeenCalledOnce()
    expect(mocks.ensure.mock.invocationCallOrder[0]).toBeLessThan(mocks.folders.mock.invocationCallOrder[0]!)
    expect(mocks.ensure.mock.invocationCallOrder[0]).toBeLessThan(mocks.queue.mock.invocationCallOrder[0]!)
  })

  it('shows migration failure without importing into a replacement and retries on reconnect', async () => {
    mocks.ensure.mockResolvedValueOnce({ success: false, error: 'Folder rename failed; retry.' })
    const { result } = renderHook(useDriveBootstrap)
    await waitFor(() => expect(result.current.statusMessage).toBe('Folder rename failed; retry.'))
    expect(mocks.queue).not.toHaveBeenCalled()
    expect(mocks.files).not.toHaveBeenCalled()
    expect(result.current.isPreparing).toBe(false)
    await act(async () => { window.dispatchEvent(new Event('online')) })
    await waitFor(() => expect(mocks.queue).toHaveBeenCalledOnce())
    expect(result.current.folderId).toBe('same-root')
  })

  it('leaves local-only workspaces independent of cloud migration', async () => {
    mocks.mode = 'local'
    const { result } = renderHook(useDriveBootstrap)
    expect(mocks.ensure).not.toHaveBeenCalled()
    expect(result.current.isPreparing).toBe(false)
  })
})
