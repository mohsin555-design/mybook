import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../database/db'
import { useAuthStore } from '../stores/useAuthStore'
import {
  backupDocumentToDrive,
  createVisibleFolder,
  ensureMyBookDriveFolder,
  importDriveFilesToLocal,
  listVisibleFoldersByName,
  updateDriveFolder,
  updateDriveFile,
} from './googleDrive'

vi.mock('../database/repositories', () => ({
}))

vi.mock('../database/db', () => ({
  db: {
    files: {
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
    fileVersions: {
      add: vi.fn(),
    },
    folders: {
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
    settings: {
      get: vi.fn(),
      put: vi.fn(),
    },
  },
}))

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}))

const mockedSettings = vi.mocked(db.settings)
const mockedFiles = vi.mocked(db.files)
const mockedFolders = vi.mocked(db.folders)
const mockedGetState = vi.mocked(useAuthStore.getState)

describe('googleDrive helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetState.mockReturnValue({ getAccessToken: () => Promise.resolve('token') } as never)
    mockedFiles.get.mockResolvedValue(undefined)
    mockedFolders.get.mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists visible folders by name', async () => {
    const json = vi.fn().mockResolvedValue({ files: [{ id: '1', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json }))

    const folders = await listVisibleFoldersByName('MyBook')

    expect(folders).toHaveLength(1)
    expect(folders[0]?.id).toBe('1')
  })

  it('creates the MyBook folder when one is not stored or found', async () => {
    mockedSettings.get.mockResolvedValue({ success: true, data: { key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' } })
    mockedSettings.put.mockResolvedValue('google-drive.mybook-folder-id')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'folder-1', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }) }))

    const result = await ensureMyBookDriveFolder()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.created).toBe(true)
      expect(result.folderId).toBe('folder-1')
    }
    expect(mockedSettings.put).toHaveBeenCalled()
  })

  it('reuses a stored MyBook folder id without calling Drive', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'stored-folder', updatedAt: '2026-07-24T00:00:00.000Z' })
    const result = await ensureMyBookDriveFolder()

    expect(result).toEqual({ success: true, folderId: 'stored-folder', folderName: 'MyBook', created: false })
  })

  it('returns a friendly offline error when the network is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    vi.stubGlobal('navigator', { onLine: false })

    await expect(createVisibleFolder('MyBook')).rejects.toThrow(/offline/i)
  })

  it('imports Drive files into local storage without creating duplicates', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note', mimeType: 'application/x-mybook-document' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      driveFileId: 'doc-1',
      name: 'Drive Note',
      isDeleted: false,
    }))
  })

  it('merges an imported Drive file into an existing local file with the same name', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-note',
      driveFileId: null,
      name: 'Drive Note',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\ntitle: Drive Note\n---\n\nHello') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).not.toHaveBeenCalled()
    expect(mockedFiles.update).toHaveBeenCalledWith('local-note', expect.objectContaining({
      driveFileId: 'doc-1',
      name: 'Drive Note',
      syncStatus: 'backed-up',
      isDeleted: false,
    }))
  })

  it('preserves updatedAt when Drive import only confirms an unchanged existing file', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-note',
      driveFileId: 'doc-1',
      name: 'Drive Note',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T09:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('{"type":"doc","content":[{"type":"paragraph"}]}') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).toHaveBeenCalledWith('local-note', expect.objectContaining({
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
    }))
  })

  it('moves a Drive file with addParents and removeParents', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ parents: ['old-parent'] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'file-1', name: 'Notes.docx', parents: ['new-parent'] }) })
    vi.stubGlobal('fetch', fetchMock)

    await updateDriveFile('file-1', { parentId: 'new-parent' })

    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('addParents=new-parent')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('removeParents=old-parent')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH', body: '{}' })
  })

  it('moves existing Drive-backed documents to their local folder during backup', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.get.mockResolvedValue({
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      isDeleted: false,
    })
    mockedFiles.get.mockResolvedValue({
      id: 'file-1',
      driveFileId: 'drive-doc',
      name: 'Notes',
      type: 'document',
      folderId: 'folder-1',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: '2026-08-29T00:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ parents: ['mybook-root'] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'drive-doc', name: 'Notes.mybook.md', modifiedTime: '2026-08-29T10:00:00.000Z' }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await backupDocumentToDrive({
      fileId: 'file-1',
      title: 'Notes',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      folderId: 'folder-1',
    })

    expect(result.success).toBe(true)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('addParents=drive-folder')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('removeParents=mybook-root')
  })

  it('moves Drive folders to the requested parent and removes old parents', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ parents: ['old-parent'] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'folder-1', name: 'Projects', mimeType: 'application/vnd.google-apps.folder' }) })
    vi.stubGlobal('fetch', fetchMock)

    await updateDriveFolder('folder-1', { parentId: 'mybook-root' })

    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('addParents=mybook-root')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('removeParents=old-parent')
  })
})
