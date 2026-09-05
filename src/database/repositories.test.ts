import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from './db'
import { fileRepository, folderRepository, processPendingDriveFolderSync, queueLocalItemsForDriveBackup } from './repositories'
import { ensureMyBookDriveFolder, ensureVisibleFolderInParent, permanentlyDeleteDriveFile, restoreDriveFolder, trashDriveFolder } from '../services/googleDrive'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

vi.mock('../services/googleDrive', () => ({
  backupDocumentToDrive: vi.fn().mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true }),
  backupSpreadsheetToDrive: vi.fn().mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: true }),
  ensureMyBookDriveFolder: vi.fn().mockResolvedValue({ success: false, error: 'offline' }),
  ensureVisibleFolderInParent: vi.fn(),
  permanentlyDeleteDriveFile: vi.fn(),
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
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
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
    await processPendingDriveFolderSync()
  })

  it('creates a Drive workspace file locally and queues before Drive work completes', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })

    const created = await fileRepository.create('document')

    expect(created.success).toBe(true)
    expect(created.data).toMatchObject({ name: 'Untitled Document', driveFileId: null, syncStatus: 'pending' })
    expect(await db.files.get(created.data!.id)).toMatchObject({ id: created.data!.id, name: 'Untitled Document' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'file', entityId: created.data!.id, operation: 'create' }])
    await processPendingDriveFolderSync()
  })

  it('deletes a Drive workspace file locally before slow Drive trash completes', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'drive-file',
      driveFileId: 'drive-file-id',
      workspaceType: 'drive',
      name: 'Drive file',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: false,
    })

    const deleted = await fileRepository.delete('drive-file')

    expect(deleted.success).toBe(true)
    expect(await db.files.get('drive-file')).toMatchObject({ isDeleted: true })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'file', entityId: 'drive-file', operation: 'delete' }])
    await processPendingDriveFolderSync()
  })

  it('renames a Drive workspace folder locally before slow Drive update completes', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const now = new Date().toISOString()
    await db.folders.add({
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      name: 'Projects',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    const renamed = await folderRepository.update('folder-1', { name: 'Projects 2026' })

    expect(renamed.success).toBe(true)
    expect(await db.folders.get('folder-1')).toMatchObject({ name: 'Projects 2026' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-1', operation: 'update' }])
    await processPendingDriveFolderSync()
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

  it('queues nested Drive folder creation locally before Drive folder creation completes', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(ensureMyBookDriveFolder).mockResolvedValue({ success: true, folderId: 'mybook-root', folderName: 'MyBook', created: false })
    vi.mocked(ensureVisibleFolderInParent)
      .mockResolvedValueOnce({ id: 'drive-parent', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' })
      .mockResolvedValueOnce({ id: 'drive-child', name: '2026', mimeType: 'application/vnd.google-apps.folder' })

    const parent = await folderRepository.create('Projects')
    const child = await folderRepository.create('2026', parent.data!.id)

    expect(parent.data).toMatchObject({ name: 'Projects', driveFolderId: null })
    expect(child.data).toMatchObject({ name: '2026', parentId: parent.data!.id, driveFolderId: null })
    expect(await db.syncQueue.toArray()).toHaveLength(2)

    await processPendingDriveFolderSync()

    expect(ensureVisibleFolderInParent).toHaveBeenNthCalledWith(1, 'Projects', 'mybook-root')
    expect(ensureVisibleFolderInParent).toHaveBeenNthCalledWith(2, '2026', 'drive-parent')
    expect((await db.folders.get(child.data!.id))?.driveFolderId).toBe('drive-child')
  })

  it('moves a folder hierarchy to Trash and hides descendants from the active workspace', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const parent = (await folderRepository.create('Projects')).data!
    const child = (await folderRepository.create('Assets', parent.id)).data!
    const file = (await fileRepository.create('document', child.id)).data!

    const deleted = await folderRepository.delete(parent.id)

    expect(deleted.success).toBe(true)
    expect(await db.folders.get(parent.id)).toMatchObject({ isDeleted: true })
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: true })
    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: true })
    expect((await folderRepository.list()).map((folder) => folder.id)).toEqual([])
    expect((await fileRepository.list()).map((item) => item.id)).toEqual([])
    expect((await folderRepository.list(true)).map((folder) => folder.id).sort()).toEqual([child.id, parent.id].sort())
  })

  it('restores a trashed folder hierarchy to its original active parent', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const root = (await folderRepository.create('Work')).data!
    const parent = (await folderRepository.create('Projects', root.id)).data!
    const child = (await folderRepository.create('Assets', parent.id)).data!
    const file = (await fileRepository.create('document', child.id)).data!

    await folderRepository.delete(parent.id)
    const restored = await folderRepository.restore(parent.id)

    expect(restored.success).toBe(true)
    expect(await db.folders.get(parent.id)).toMatchObject({ isDeleted: false, parentId: root.id })
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: false, parentId: parent.id })
    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: false, folderId: child.id })
  })

  it('restores a folder to root when its original parent is missing', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const parent = (await folderRepository.create('Work')).data!
    const child = (await folderRepository.create('Projects', parent.id)).data!

    await folderRepository.delete(child.id)
    await db.folders.delete(parent.id)
    const restored = await folderRepository.restore(child.id)

    expect(restored.success).toBe(true)
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: false, parentId: null })
  })

  it('restores a folder to root when its original parent remains trashed', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const parent = (await folderRepository.create('Work')).data!
    const child = (await folderRepository.create('Projects', parent.id)).data!

    await folderRepository.delete(parent.id)
    const restored = await folderRepository.restore(child.id)

    expect(restored.success).toBe(true)
    expect(await db.folders.get(parent.id)).toMatchObject({ isDeleted: true })
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: false, parentId: null })
  })

  it('permanently deletes a trashed folder hierarchy locally', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const parent = (await folderRepository.create('Projects')).data!
    const child = (await folderRepository.create('Assets', parent.id)).data!
    const file = (await fileRepository.create('document', child.id)).data!
    await folderRepository.delete(parent.id)

    const deleted = await folderRepository.permanentlyDelete(parent.id)

    expect(deleted.success).toBe(true)
    expect(await db.folders.get(parent.id)).toBeUndefined()
    expect(await db.folders.get(child.id)).toBeUndefined()
    expect(await db.files.get(file.id)).toBeUndefined()
  })

  it('queues durable Drive file permanent delete before final local cleanup', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'file-1',
      driveFileId: 'drive-file-1',
      workspaceType: 'drive',
      name: 'Old notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: true,
    })

    const deleted = await fileRepository.permanentlyDelete('file-1')

    expect(deleted.success).toBe(true)
    expect(await db.files.get('file-1')).toMatchObject({ isDeleted: true, driveFileId: 'drive-file-1', syncStatus: 'pending' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'file', entityId: 'file-1', operation: 'permanent-delete' }])
    expect(permanentlyDeleteDriveFile).not.toHaveBeenCalled()
  })

  it('finalizes local file cleanup after Drive permanent delete succeeds', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'file-1',
      driveFileId: 'drive-file-1',
      workspaceType: 'drive',
      name: 'Old notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: true,
    })
    vi.mocked(permanentlyDeleteDriveFile).mockResolvedValue(undefined)

    await fileRepository.permanentlyDelete('file-1')
    await processPendingDriveFolderSync()

    expect(permanentlyDeleteDriveFile).toHaveBeenCalledWith('drive-file-1')
    expect(await db.files.get('file-1')).toBeUndefined()
    expect(await db.syncQueue.toArray()).toHaveLength(0)
  })

  it('keeps Drive file permanent delete retryable after transient failure', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.files.add({
      id: 'file-1',
      driveFileId: 'drive-file-1',
      workspaceType: 'drive',
      name: 'Old notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: true,
    })
    vi.mocked(permanentlyDeleteDriveFile).mockRejectedValue(new Error('temporary outage'))

    await fileRepository.permanentlyDelete('file-1')
    await processPendingDriveFolderSync()

    expect(await db.files.get('file-1')).toMatchObject({ isDeleted: true, syncStatus: 'failed', syncError: 'temporary outage' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'file', entityId: 'file-1', operation: 'permanent-delete', status: 'failed', errorMessage: 'temporary outage' }])
  })

  it('deletes local workspace files without queueing Drive permanent delete', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const file = (await fileRepository.create('document')).data!
    await fileRepository.delete(file.id)

    const deleted = await fileRepository.permanentlyDelete(file.id)

    expect(deleted.success).toBe(true)
    expect(await db.files.get(file.id)).toBeUndefined()
    expect(await db.syncQueue.toArray()).toHaveLength(0)
    expect(permanentlyDeleteDriveFile).not.toHaveBeenCalled()
  })

  it('queues only root Drive folder permanent delete before final subtree cleanup', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.folders.bulkAdd([
      { id: 'folder-parent', driveFolderId: 'drive-parent', workspaceType: 'drive', name: 'Projects', parentId: null, createdAt: now, updatedAt: now, isDeleted: true },
      { id: 'folder-child', driveFolderId: 'drive-child', workspaceType: 'drive', name: 'Assets', parentId: 'folder-parent', createdAt: now, updatedAt: now, isDeleted: true },
    ])
    await db.files.add({ id: 'file-child', driveFileId: 'drive-file-child', workspaceType: 'drive', name: 'Budget', type: 'document', folderId: 'folder-child', content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: true })

    const deleted = await folderRepository.permanentlyDelete('folder-parent')

    expect(deleted.success).toBe(true)
    expect(await db.folders.get('folder-parent')).toMatchObject({ isDeleted: true, driveFolderId: 'drive-parent' })
    expect(await db.folders.get('folder-child')).toMatchObject({ isDeleted: true, driveFolderId: 'drive-child' })
    expect(await db.files.get('file-child')).toMatchObject({ isDeleted: true, driveFileId: 'drive-file-child' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-parent', operation: 'permanent-delete' }])
    expect(permanentlyDeleteDriveFile).not.toHaveBeenCalled()
  })

  it('finalizes local folder subtree cleanup after root Drive hard delete succeeds', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.folders.bulkAdd([
      { id: 'folder-parent', driveFolderId: 'drive-parent', workspaceType: 'drive', name: 'Projects', parentId: null, createdAt: now, updatedAt: now, isDeleted: true },
      { id: 'folder-child', driveFolderId: 'drive-child', workspaceType: 'drive', name: 'Assets', parentId: 'folder-parent', createdAt: now, updatedAt: now, isDeleted: true },
    ])
    await db.files.add({ id: 'file-child', driveFileId: 'drive-file-child', workspaceType: 'drive', name: 'Budget', type: 'document', folderId: 'folder-child', content: '', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'backed-up', isDeleted: true })
    vi.mocked(permanentlyDeleteDriveFile).mockResolvedValue(undefined)

    await folderRepository.permanentlyDelete('folder-parent')
    await processPendingDriveFolderSync()

    expect(permanentlyDeleteDriveFile).toHaveBeenCalledTimes(1)
    expect(permanentlyDeleteDriveFile).toHaveBeenCalledWith('drive-parent')
    expect(await db.folders.get('folder-parent')).toBeUndefined()
    expect(await db.folders.get('folder-child')).toBeUndefined()
    expect(await db.files.get('file-child')).toBeUndefined()
    expect(await db.syncQueue.toArray()).toHaveLength(0)
  })

  it('keeps Drive folder permanent delete retryable after permission failure', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.folders.add({ id: 'folder-parent', driveFolderId: 'drive-parent', workspaceType: 'drive', name: 'Projects', parentId: null, createdAt: now, updatedAt: now, isDeleted: true })
    vi.mocked(permanentlyDeleteDriveFile).mockRejectedValue(new Error('insufficient permissions'))

    await folderRepository.permanentlyDelete('folder-parent')
    await processPendingDriveFolderSync()

    expect(await db.folders.get('folder-parent')).toMatchObject({ isDeleted: true, driveFolderId: 'drive-parent' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-parent', operation: 'permanent-delete', status: 'failed', errorMessage: 'insufficient permissions' }])
  })

  it('coalesces pending update and failed soft delete into permanent delete intent', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.files.add({ id: 'file-1', driveFileId: 'drive-file-1', workspaceType: 'drive', name: 'Old notes', type: 'document', folderId: null, content: 'draft', mimeType: 'application/x-mybook-document', createdAt: now, updatedAt: now, lastSyncedAt: now, syncStatus: 'failed', syncError: 'soft delete failed', isDeleted: true })
    await db.syncQueue.add({ id: 'queue-1', entityId: 'file-1', entityType: 'file', operation: 'delete', status: 'failed', retryCount: 1, createdAt: now, updatedAt: now, errorMessage: 'soft delete failed' })

    const deleted = await fileRepository.permanentlyDelete('file-1')

    expect(deleted.success).toBe(true)
    expect(await db.syncQueue.toArray()).toMatchObject([{ id: 'queue-1', entityType: 'file', entityId: 'file-1', operation: 'permanent-delete', status: 'pending' }])
  })

  it('keeps Drive folder trash and restore local-first with queued sync operations', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = new Date().toISOString()
    await db.folders.add({
      id: 'folder-1',
      driveFolderId: 'drive-folder-1',
      workspaceType: 'drive',
      name: 'Projects',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    const deleted = await folderRepository.delete('folder-1')

    expect(deleted.success).toBe(true)
    expect(await db.folders.get('folder-1')).toMatchObject({ isDeleted: true, driveFolderId: 'drive-folder-1' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-1', operation: 'delete' }])
    expect(trashDriveFolder).not.toHaveBeenCalled()

    const restored = await folderRepository.restore('folder-1')

    expect(restored.success).toBe(true)
    expect(await db.folders.get('folder-1')).toMatchObject({ isDeleted: false, driveFolderId: 'drive-folder-1' })
    expect(await db.syncQueue.toArray()).toMatchObject([{ entityType: 'folder', entityId: 'folder-1', operation: 'restore' }])
    expect(restoreDriveFolder).not.toHaveBeenCalled()
  })

  it('avoids duplicate names when duplicating files', async () => {
    const source = (await fileRepository.create('document')).data!
    await fileRepository.update(source.id, { name: 'Notes' })
    const first = await fileRepository.duplicate(source.id)
    const second = await fileRepository.duplicate(source.id)
    expect(first.data?.name).toBe('Notes copy')
    expect(second.data?.name).toBe('Notes copy 2')
  })

  it('favorites and unfavorites files without changing recency or queueing sync', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const file = (await fileRepository.create('document')).data!
    const originalUpdatedAt = (await db.files.get(file.id))!.updatedAt

    await expect(fileRepository.setFavorite(file.id, true)).resolves.toEqual({ success: true })
    expect(await db.files.get(file.id)).toMatchObject({ isFavorite: true, updatedAt: originalUpdatedAt })
    expect(await db.syncQueue.toArray()).toHaveLength(0)

    await expect(fileRepository.setFavorite(file.id, false)).resolves.toEqual({ success: true })
    expect(await db.files.get(file.id)).toMatchObject({ isFavorite: false, updatedAt: originalUpdatedAt })
    expect(await db.syncQueue.toArray()).toHaveLength(0)
  })

  it('favorites and unfavorites folders without changing recency or queueing sync', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const folder = (await folderRepository.create('Projects')).data!
    const originalUpdatedAt = (await db.folders.get(folder.id))!.updatedAt

    await expect(folderRepository.setFavorite(folder.id, true)).resolves.toEqual({ success: true })
    expect(await db.folders.get(folder.id)).toMatchObject({ isFavorite: true, updatedAt: originalUpdatedAt })
    expect(await db.syncQueue.toArray()).toHaveLength(0)

    await expect(folderRepository.setFavorite(folder.id, false)).resolves.toEqual({ success: true })
    expect(await db.folders.get(folder.id)).toMatchObject({ isFavorite: false, updatedAt: originalUpdatedAt })
    expect(await db.syncQueue.toArray()).toHaveLength(0)
  })

  it('keeps favorite file state through Trash and direct restore while active lists hide trashed items', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const file = (await fileRepository.create('document')).data!
    await fileRepository.setFavorite(file.id, true)

    await fileRepository.delete(file.id)

    expect((await fileRepository.list()).map((item) => item.id)).toEqual([])
    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: true, isFavorite: true })

    await fileRepository.restore(file.id)

    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: false, isFavorite: true })
    expect((await fileRepository.list()).map((item) => item.id)).toEqual([file.id])
  })

  it('keeps favorite folder state through Trash cascade and restore while active lists hide trashed items', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const folder = (await folderRepository.create('Projects')).data!
    const child = (await folderRepository.create('Assets', folder.id)).data!
    const file = (await fileRepository.create('document', child.id)).data!
    await folderRepository.setFavorite(folder.id, true)

    await folderRepository.delete(folder.id)

    expect((await fileRepository.list()).map((item) => item.id)).toEqual([])
    expect((await folderRepository.list()).map((item) => item.id)).toEqual([])
    expect(await db.folders.get(folder.id)).toMatchObject({ isDeleted: true, isFavorite: true })

    await folderRepository.restore(folder.id)

    expect(await db.folders.get(folder.id)).toMatchObject({ isDeleted: false, isFavorite: true })
    expect(await db.folders.get(child.id)).toMatchObject({ isDeleted: false })
    expect(await db.files.get(file.id)).toMatchObject({ isDeleted: false })
    expect((await folderRepository.list()).map((item) => item.id).sort()).toEqual([child.id, folder.id].sort())
  })

  it('does not let duplicated files inherit favorite state', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const source = (await fileRepository.create('document')).data!
    await fileRepository.setFavorite(source.id, true)

    const duplicated = await fileRepository.duplicate(source.id)

    expect(duplicated.success).toBe(true)
    expect(duplicated.data).toMatchObject({ isFavorite: false })
    expect(await db.files.get(source.id)).toMatchObject({ isFavorite: true })
  })

  it('does not cascade folder favorite state to descendants', async () => {
    useWorkspaceStore.setState({ mode: 'local' })
    const folder = (await folderRepository.create('Projects')).data!
    const child = (await folderRepository.create('Assets', folder.id)).data!
    const file = (await fileRepository.create('document', folder.id)).data!

    await folderRepository.setFavorite(folder.id, true)

    expect(await db.folders.get(folder.id)).toMatchObject({ isFavorite: true })
    expect(await db.folders.get(child.id)).not.toMatchObject({ isFavorite: true })
    expect(await db.files.get(file.id)).not.toMatchObject({ isFavorite: true })
  })

  it('keeps Drive workspace favorite toggles local-first without Drive queue work', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    useWorkspaceStore.setState({ mode: 'drive' })
    const now = '2026-08-29T00:00:00.000Z'
    await db.files.add({
      id: 'drive-file',
      driveFileId: 'drive-file-id',
      workspaceType: 'drive',
      name: 'Drive notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'backed-up',
      isDeleted: false,
    })
    await db.folders.add({
      id: 'drive-folder',
      driveFolderId: 'drive-folder-id',
      workspaceType: 'drive',
      name: 'Drive projects',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })

    await expect(fileRepository.setFavorite('drive-file', true)).resolves.toEqual({ success: true })
    await expect(folderRepository.setFavorite('drive-folder', true)).resolves.toEqual({ success: true })

    expect(await db.files.get('drive-file')).toMatchObject({ isFavorite: true, updatedAt: now })
    expect(await db.folders.get('drive-folder')).toMatchObject({ isFavorite: true, updatedAt: now })
    expect(await db.syncQueue.toArray()).toHaveLength(0)
    expect(ensureMyBookDriveFolder).not.toHaveBeenCalled()
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
