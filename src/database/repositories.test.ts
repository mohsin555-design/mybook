import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from './db'
import { fileRepository, folderRepository, processPendingDriveFolderSync, queueLocalItemsForDriveBackup } from './repositories'
import { ensureMyBookDriveFolder, ensureVisibleFolderInParent } from '../services/googleDrive'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

vi.mock('../services/googleDrive', () => ({
  backupDocumentToDrive: vi.fn().mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true }),
  backupSpreadsheetToDrive: vi.fn().mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true }),
  ensureMyBookDriveFolder: vi.fn().mockResolvedValue({ success: false, error: 'offline' }),
  ensureVisibleFolderInParent: vi.fn(),
  restoreDriveFile: vi.fn(), restoreDriveFolder: vi.fn(), trashDriveFile: vi.fn(), trashDriveFolder: vi.fn(),
  updateDriveFolder: vi.fn(),
}))

describe('IndexedDB repositories', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: false, error: 'offline' })
    vi.mocked(ensureVisibleFolderInParent).mockReset()
    await db.delete()
    await db.open()
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: null })
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

  it('creates files with unique default names in the same folder', async () => {
    const firstDocument = await fileRepository.create('document')
    const secondDocument = await fileRepository.create('document')
    const firstSpreadsheet = await fileRepository.create('spreadsheet')
    const secondSpreadsheet = await fileRepository.create('spreadsheet')

    expect(firstDocument.data?.name).toBe('Untitled Document')
    expect(secondDocument.data?.name).toBe('Untitled Document 2')
    expect(firstSpreadsheet.data?.name).toBe('Untitled Spreadsheet')
    expect(secondSpreadsheet.data?.name).toBe('Untitled Spreadsheet 2')

    const files = await fileRepository.list()
    expect(files.map((file) => file.name).sort()).toEqual([
      'Untitled Document',
      'Untitled Document 2',
      'Untitled Spreadsheet',
      'Untitled Spreadsheet 2',
    ])
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

  it('does not queue Drive work for a local workspace', async () => {
    useWorkspaceStore.setState({ mode: 'local' })

    const file = await fileRepository.create('document')
    const folder = await folderRepository.create('Local folder')
    await fileRepository.update(file.data!.id, { content: '{"type":"doc","content":[{"type":"paragraph"}]}', folderId: folder.data!.id })

    expect(file.data?.syncStatus).toBe('local')
    expect((await db.files.get(file.data!.id))?.syncStatus).toBe('local')
    expect(await db.syncQueue.toArray()).toHaveLength(0)
    expect(ensureMyBookDriveFolder).not.toHaveBeenCalled()
  })

  it('hides cached Drive files and folders in local workspace mode', async () => {
    const now = new Date().toISOString()
    await db.folders.bulkAdd([
      { id: 'drive-folder', driveFolderId: 'drive-folder-id', name: 'Drive folder', parentId: null, createdAt: now, updatedAt: now, isDeleted: false },
      { id: 'local-folder', driveFolderId: null, workspaceType: 'local', name: 'Local folder', parentId: null, createdAt: now, updatedAt: now, isDeleted: false },
    ])
    await db.files.bulkAdd([
      { id: 'drive-file', driveFileId: 'drive-file-id', name: 'Drive file', type: 'document', folderId: null, content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: false },
      { id: 'local-file', driveFileId: null, workspaceType: 'local', name: 'Local file', type: 'document', folderId: null, content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: null, syncStatus: 'local', isDeleted: false },
    ])

    useWorkspaceStore.setState({ mode: 'local' })

    expect((await fileRepository.list()).map((file) => file.id)).toEqual(['local-file'])
    expect((await folderRepository.list()).map((folder) => folder.id)).toEqual(['local-folder'])
    expect((await fileRepository.get('drive-file')).data).toBeUndefined()
    expect((await folderRepository.get('drive-folder')).data).toBeUndefined()
  })

  it('treats legacy unmarked rows as Drive workspace items', async () => {
    const now = new Date().toISOString()
    await db.files.add({ id: 'legacy-drive-file', driveFileId: 'drive-file-id', name: 'Drive file', type: 'document', folderId: null, content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: false })

    useWorkspaceStore.setState({ mode: 'drive' })

    expect((await fileRepository.list()).map((file) => file.id)).toEqual(['legacy-drive-file'])
  })

  it('does not wait for Drive sync before completing a local content update', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockImplementation(() => new Promise(() => undefined))
    const now = new Date().toISOString()
    await db.files.add({
      id: 'drive-file',
      driveFileId: null,
      workspaceType: 'drive',
      name: 'Drive file',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    })

    await expect(fileRepository.update('drive-file', { content: 'changed', syncStatus: 'pending' })).resolves.toEqual({ success: true })
    expect((await db.files.get('drive-file'))?.content).toBe('changed')
    expect((await db.syncQueue.toArray())).toHaveLength(1)
  })

  it('queues local workspace files when switching to Drive backup', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const file = await fileRepository.create('document')
    const folder = await folderRepository.create('Local folder')
    expect(await db.syncQueue.toArray()).toHaveLength(0)

    useWorkspaceStore.setState({ mode: 'drive' })
    await queueLocalItemsForDriveBackup()

    expect((await db.files.get(file.data!.id))?.syncStatus).toBe('pending')
    expect((await db.syncQueue.toArray()).map((item) => `${item.entityType}:${item.entityId}`).sort()).toEqual([
      `file:${file.data!.id}`,
      `folder:${folder.data!.id}`,
    ])
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

  it('lists one logical file when local duplicate records exist', async () => {
    const now = new Date().toISOString()
    await db.files.bulkAdd([
      {
        id: 'local-copy',
        driveFileId: null,
        name: 'Project Plan',
        type: 'document',
        folderId: null,
        content: 'local',
        mimeType: 'application/x-mybook-document',
        createdAt: now,
        updatedAt: '2026-08-22T08:00:00.000Z',
        lastSyncedAt: null,
        syncStatus: 'pending',
        isDeleted: false,
      },
      {
        id: 'synced-copy',
        driveFileId: 'drive-project-plan',
        name: 'Project Plan',
        type: 'document',
        folderId: null,
        content: 'synced',
        mimeType: 'application/x-mybook-document',
        createdAt: now,
        updatedAt: '2026-08-22T07:00:00.000Z',
        lastSyncedAt: '2026-08-22T07:00:00.000Z',
        syncStatus: 'backed-up',
        isDeleted: false,
      },
    ])

    const files = await fileRepository.list()

    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ id: 'synced-copy', driveFileId: 'drive-project-plan' })
  })

  it('hides backup file extensions from app-visible names', async () => {
    const now = new Date().toISOString()
    await db.files.bulkAdd([
      {
        id: 'markdown-backup-name',
        driveFileId: 'drive-markdown',
        name: 'Meeting Notes.mybook.md',
        type: 'document',
        folderId: null,
        content: '',
        mimeType: 'application/x-mybook-document',
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now,
        syncStatus: 'backed-up',
        isDeleted: false,
      },
      {
        id: 'spreadsheet-backup-name',
        driveFileId: 'drive-sheet',
        name: 'Budget.xlsx',
        type: 'spreadsheet',
        folderId: null,
        content: '',
        mimeType: 'application/x-mybook-spreadsheet',
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now,
        syncStatus: 'backed-up',
        isDeleted: false,
      },
    ])

    const files = await fileRepository.list()
    const document = (await fileRepository.get('markdown-backup-name')).data

    expect(files.map((file) => file.name).sort()).toEqual(['Budget', 'Meeting Notes'])
    expect(document?.name).toBe('Meeting Notes')
  })
})
