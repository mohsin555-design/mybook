// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../database/db'
import { exportLocalWorkspaceBackup } from './localBackup'

describe('local workspace backups', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    vi.restoreAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('falls back to a text/plain share file when JSON files are not shareable', async () => {
    const now = new Date().toISOString()
    await db.files.add({
      id: 'file-1',
      driveFileId: null,
      name: 'Notes',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: false,
    })
    const canShare = vi.fn((data: { files?: File[] }) => data.files?.[0]?.type === 'text/plain')
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare })
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })

    const result = await exportLocalWorkspaceBackup()

    expect(result).toMatchObject({ success: true, method: 'share', mimeType: 'text/plain' })
    expect(canShare).toHaveBeenCalledTimes(2)
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      files: [expect.objectContaining({ name: expect.stringMatching(/\.mybook-backup\.json$/), type: 'text/plain' })],
    }))
  })

  it('downloads the backup when file sharing is unavailable', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => false) })
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    const result = await exportLocalWorkspaceBackup()

    expect(result).toMatchObject({ success: true, method: 'download' })
    expect(click).toHaveBeenCalled()
  })
})
