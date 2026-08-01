import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from './db'
import { fileRepository, folderRepository, processPendingDriveFolderSync } from './repositories'
import { ensureMyBookDriveFolder, ensureVisibleFolderInParent } from '../services/googleDrive'

vi.mock('../services/googleDrive', () => ({
  ensureMyBookDriveFolder: vi.fn().mockResolvedValue({ success: false, error: 'offline' }),
  ensureVisibleFolderInParent: vi.fn(),
  restoreDriveFile: vi.fn(), restoreDriveFolder: vi.fn(), trashDriveFile: vi.fn(), trashDriveFolder: vi.fn(),
  updateDriveFile: vi.fn(), updateDriveFolder: vi.fn(),
}))

describe('IndexedDB repositories', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    vi.stubGlobal('navigator', { onLine: false })
  })

  it('creates, renames, deletes, and restores a file locally', async () => {
    const created = await fileRepository.create('document')
    expect(created.success).toBe(true)
    const id = created.data!.id
    expect((await fileRepository.update(id, { name: 'Meeting Notes' })).success).toBe(true)
    expect((await fileRepository.update(id, { content: 'local content' })).success).toBe(true)
    expect((await fileRepository.delete(id)).success).toBe(true)
    expect((await fileRepository.restore(id)).success).toBe(true)
    expect((await fileRepository.get(id)).data).toMatchObject({ name: 'Meeting Notes', content: 'local content', isDeleted: false })
  })

  it('creates nested folders and queues offline Drive work', async () => {
    const parent = await folderRepository.create('Projects')
    const child = await folderRepository.create('2026', parent.data!.id)
    expect(child.data?.parentId).toBe(parent.data?.id)
    const queue = await db.syncQueue.toArray()
    expect(queue).toHaveLength(2)
    await processPendingDriveFolderSync()
    expect((await db.syncQueue.toArray())[0]?.status).toBe('pending')
  })

  it('creates a nested Drive folder under its synced parent', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
    vi.mocked(ensureVisibleFolderInParent)
      .mockResolvedValueOnce({ id: 'drive-parent', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' })
      .mockResolvedValueOnce({ id: 'drive-child', name: '2026', mimeType: 'application/vnd.google-apps.folder' })

    const parent = await folderRepository.create('Projects')
    const child = await folderRepository.create('2026', parent.data!.id)

    expect(ensureVisibleFolderInParent).toHaveBeenNthCalledWith(1, 'Projects', 'mybook-root')
    expect(ensureVisibleFolderInParent).toHaveBeenNthCalledWith(2, '2026', 'drive-parent')
    expect(child.data?.driveFolderId).toBe('drive-child')
  })

  it('avoids duplicate names when duplicating files', async () => {
    const source = (await fileRepository.create('document')).data!
    await fileRepository.update(source.id, { name: 'Notes' })
    const first = await fileRepository.duplicate(source.id)
    const second = await fileRepository.duplicate(source.id)
    expect(first.data?.name).toBe('Notes copy')
    expect(second.data?.name).toBe('Notes copy 2')
  })
})
