import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../database/db'
import { useAuthStore } from '../stores/useAuthStore'
import {
  backupDocumentToDrive,
  classifyDriveTrashMetadata,
  createVisibleFolder,
  ensureMyBookDriveFolder,
  importDriveFoldersToLocal,
  importDriveFilesToLocal,
  listTrashedMyBookDriveFiles,
  listTrashedMyBookDriveFolders,
  listVisibleFoldersByName,
  permanentlyDeleteDriveFile,
  updateDriveFolder,
  updateDriveFile,
} from './googleDrive'

vi.mock('../database/repositories', () => ({
}))

vi.mock('../utils/xlsx', () => ({
  importXlsxToWorkbook: vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'imported-workbook',
      name: 'Imported workbook',
      sheets: [],
      activeSheetId: null,
    },
  }),
}))

vi.mock('../database/db', () => ({
  db: {
    files: {
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
      filter: vi.fn(),
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
    syncQueue: {
      filter: vi.fn(),
    },
    settings: {
      get: vi.fn(),
      put: vi.fn(),
    },
    transaction: vi.fn(async (...args: unknown[]) => {
      const callback = args.at(-1)
      if (typeof callback === 'function') await callback()
    }),
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
const mockedSyncQueue = vi.mocked(db.syncQueue)
const mockedGetState = vi.mocked(useAuthStore.getState)

function mockUnresolvedSyncQueue(items: unknown[] = []) {
  mockedSyncQueue.filter.mockImplementation(((predicate: (item: unknown) => boolean) => ({
    toArray: vi.fn().mockResolvedValue(items.filter(predicate)),
    modify: vi.fn().mockResolvedValue(undefined),
  })) as never)
}

function mockEmptyFileFilter() {
  mockedFiles.filter.mockReturnValue({
    modify: vi.fn().mockResolvedValue(undefined),
  } as never)
}

describe('googleDrive helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetState.mockReturnValue({ getAccessToken: () => Promise.resolve('token') } as never)
    mockedFiles.get.mockResolvedValue(undefined)
    mockedFolders.get.mockResolvedValue(undefined)
    mockUnresolvedSyncQueue()
    mockEmptyFileFilter()
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

  it('permanently deletes a Drive item with files.delete', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: vi.fn() })
    vi.stubGlobal('fetch', fetchMock)

    await expect(permanentlyDeleteDriveFile('drive-file')).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith('https://www.googleapis.com/drive/v3/files/drive-file', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('treats an already-missing Drive item as permanent-delete success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: vi.fn().mockResolvedValue({ error: { message: 'File not found' } }) }))

    await expect(permanentlyDeleteDriveFile('missing-drive-file')).resolves.toBeUndefined()
  })

  it('keeps permission failures retryable for permanent Drive delete callers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: vi.fn().mockResolvedValue({ error: { message: 'insufficient permissions' } }) }))

    await expect(permanentlyDeleteDriveFile('drive-file')).rejects.toThrow('insufficient permissions')
  })

  it('lists trashed Mybook file metadata with explicit trash and parent fields', async () => {
    const json = vi.fn().mockResolvedValue({
      files: [{
        id: 'drive-file',
        name: 'Notes.mybook.md',
        mimeType: 'text/markdown',
        parents: ['drive-folder'],
        trashed: true,
        explicitlyTrashed: true,
        appProperties: { custom: 'value' },
        modifiedTime: '2026-09-05T00:00:00.000Z',
      }],
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json })
    vi.stubGlobal('fetch', fetchMock)

    const files = await listTrashedMyBookDriveFiles('drive-folder')

    expect(files).toEqual([{
      id: 'drive-file',
      name: 'Notes.mybook.md',
      mimeType: 'text/markdown',
      parents: ['drive-folder'],
      trashed: true,
      explicitlyTrashed: true,
      appProperties: { custom: 'value' },
      modifiedTime: '2026-09-05T00:00:00.000Z',
      mybookFolderId: null,
    }])
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain("mimeType!='application/vnd.google-apps.folder' and trashed=true")
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain('explicitlyTrashed')
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain('appProperties')
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain('parents')
  })

  it('lists trashed folder metadata and recovers appProperties mybookFolderId', async () => {
    const json = vi.fn().mockResolvedValue({
      files: [
        {
          id: 'drive-folder-a',
          name: 'Projects',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['mybook-root'],
          trashed: true,
          explicitlyTrashed: true,
          appProperties: { mybookFolderId: 'folder_abc' },
        },
        {
          id: 'drive-folder-b',
          name: 'Budget',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['drive-folder-a'],
          trashed: true,
          explicitlyTrashed: false,
        },
      ],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json }))

    const folders = await listTrashedMyBookDriveFolders('mybook-root')

    expect(folders[0]).toMatchObject({
      id: 'drive-folder-a',
      explicitlyTrashed: true,
      mybookFolderId: 'folder_abc',
    })
    expect(folders[1]).toMatchObject({
      id: 'drive-folder-b',
      explicitlyTrashed: false,
      mybookFolderId: null,
    })
  })

  it('classifies independent trash roots and recursive trash descendants', () => {
    const classified = classifyDriveTrashMetadata([
      { id: 'drive-a', name: 'A', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], trashed: true, explicitlyTrashed: true },
      { id: 'drive-b', name: 'B', mimeType: 'application/vnd.google-apps.folder', parents: ['drive-a'], trashed: true, explicitlyTrashed: false },
      { id: 'drive-c', name: 'C', mimeType: 'application/vnd.google-apps.folder', parents: ['drive-a'], trashed: true, explicitlyTrashed: true },
    ])

    expect(classified.find((item) => item.id === 'drive-a')).toMatchObject({
      classification: 'independent-trash-root',
      trashedByAncestorDriveId: null,
    })
    expect(classified.find((item) => item.id === 'drive-b')).toMatchObject({
      classification: 'recursive-trash-descendant',
      trashedByAncestorDriveId: 'drive-a',
    })
    expect(classified.find((item) => item.id === 'drive-c')).toMatchObject({
      classification: 'independent-trash-root',
      trashedByAncestorDriveId: null,
    })
  })

  it('models parent restore while preserving independently trashed descendants', () => {
    const classified = classifyDriveTrashMetadata([
      { id: 'projects', name: 'Projects', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], trashed: true, explicitlyTrashed: true },
      { id: 'notes', name: 'Notes', mimeType: 'text/markdown', parents: ['projects'], trashed: true, explicitlyTrashed: true },
      { id: 'budget', name: 'Budget', mimeType: 'text/markdown', parents: ['projects'], trashed: true, explicitlyTrashed: false },
      { id: 'assets', name: 'Assets', mimeType: 'application/vnd.google-apps.folder', parents: ['projects'], trashed: true, explicitlyTrashed: false },
    ])

    const restoredWithProjects = classified
      .filter((item) => item.id === 'projects' || item.trashedByAncestorDriveId === 'projects')
      .map((item) => item.id)
      .sort()
    const remainsTrashed = classified
      .filter((item) => item.id !== 'projects' && item.trashedByAncestorDriveId !== 'projects')
      .map((item) => item.id)

    expect(restoredWithProjects).toEqual(['assets', 'budget', 'projects'])
    expect(remainsTrashed).toEqual(['notes'])
  })

  it('classifies multiple nested recursive descendants under the explicit trash root', () => {
    const classified = classifyDriveTrashMetadata([
      { id: 'a', name: 'A', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], trashed: true, explicitlyTrashed: true },
      { id: 'b', name: 'B', mimeType: 'application/vnd.google-apps.folder', parents: ['a'], trashed: true, explicitlyTrashed: false },
      { id: 'c', name: 'C', mimeType: 'application/vnd.google-apps.folder', parents: ['b'], trashed: true, explicitlyTrashed: false },
      { id: 'file', name: 'File', mimeType: 'text/markdown', parents: ['c'], trashed: true, explicitlyTrashed: false },
    ])

    expect(classified.filter((item) => item.id !== 'a').map((item) => item.trashedByAncestorDriveId)).toEqual(['a', 'a', 'a'])
  })

  it('keeps nested independently trashed folders as their own trash roots', () => {
    const classified = classifyDriveTrashMetadata([
      { id: 'a', name: 'A', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], trashed: true, explicitlyTrashed: true },
      { id: 'b', name: 'B', mimeType: 'application/vnd.google-apps.folder', parents: ['a'], trashed: true, explicitlyTrashed: true },
      { id: 'c', name: 'C', mimeType: 'application/vnd.google-apps.folder', parents: ['b'], trashed: true, explicitlyTrashed: false },
    ])

    expect(classified.find((item) => item.id === 'b')).toMatchObject({
      classification: 'independent-trash-root',
      trashedByAncestorDriveId: null,
    })
    expect(classified.find((item) => item.id === 'c')).toMatchObject({
      classification: 'recursive-trash-descendant',
      trashedByAncestorDriveId: 'b',
    })
  })

  it('demonstrates trashed mybook markdown can flow through the existing download path when Drive returns media', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'trashed-doc', name: 'Deleted.mybook.md', mimeType: 'text/markdown', parents: ['mybook-root'], modifiedTime: '2026-09-05T00:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-deleted"\ntitle: "Deleted"\n---\n\nDeleted content') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(true)
    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      id: 'doc-deleted',
      driveFileId: 'trashed-doc',
    }))
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

  it('skips content download and local rewrite when Drive import only confirms an unchanged existing document', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-note',
      driveFileId: 'doc-1',
      workspaceType: 'drive',
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T09:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(false)
    expect(mockedFiles.update).not.toHaveBeenCalledWith('local-note', expect.anything())
  })

  it('skips content download and local rewrite when Drive import only confirms an unchanged existing spreadsheet', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'sheet-1',
      driveFileId: 'drive-sheet',
      workspaceType: 'drive',
      name: 'Budget',
      type: 'spreadsheet',
      folderId: null,
      content: '{"id":"sheet-1","sheets":[]}',
      mimeType: 'application/x-mybook-spreadsheet',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-sheet', name: 'Budget.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', modifiedTime: '2026-08-22T09:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(false)
    expect(mockedFiles.update).not.toHaveBeenCalledWith('sheet-1', expect.anything())
  })

  it('downloads and imports a Drive-changed document for an older returning device', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-note',
      driveFileId: 'doc-1',
      name: 'Drive Note',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Old"}]}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Drive Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ntitle: "Drive Note"\n---\n\nNew content') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(true)
    expect(mockedFiles.update).toHaveBeenCalledWith('local-note', expect.objectContaining({
      content: expect.stringContaining('New content'),
      lastSyncedAt: '2026-08-22T10:00:00.000Z',
      syncStatus: 'backed-up',
    }))
  })

  it('downloads and imports a Drive-changed spreadsheet for an older returning device', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'sheet-1',
      driveFileId: 'drive-sheet',
      name: 'Budget',
      type: 'spreadsheet',
      folderId: null,
      content: '{"id":"old-workbook","sheets":[]}',
      mimeType: 'application/x-mybook-spreadsheet',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-sheet', name: 'Budget.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(['xlsx'])) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
    vi.stubGlobal('fetch', fetchMock)

    await importDriveFilesToLocal()

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('alt=media'))).toBe(true)
    expect(mockedFiles.update).toHaveBeenCalledWith('sheet-1', expect.objectContaining({
      content: expect.stringContaining('imported-workbook'),
      lastSyncedAt: '2026-08-22T10:00:00.000Z',
      syncStatus: 'backed-up',
    }))
  })

  it.each(['pending', 'processing', 'failed'] as const)('keeps pending local file move, rename, and content when Drive import is stale and queue is %s', async (status) => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'file-1',
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      name: 'Project Plan',
      type: 'document',
      folderId: 'folder-b',
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"local draft"}]}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: status === 'failed' ? 'failed' : 'pending',
      isDeleted: false,
    }])
    mockUnresolvedSyncQueue([{
      id: 'queue-file',
      entityId: 'file-1',
      entityType: 'file',
      operation: 'update',
      status,
      retryCount: 0,
      createdAt: '2026-08-22T12:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      errorMessage: status === 'failed' ? 'temporary failure' : null,
    }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-doc', name: 'Project.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T13:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).toHaveBeenCalledWith('file-1', {
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      type: 'document',
      mimeType: 'text/markdown',
    })
    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-1', expect.objectContaining({
      name: 'Project',
      folderId: null,
      content: expect.stringContaining('stale drive'),
      isDeleted: false,
      syncStatus: 'backed-up',
      lastSyncedAt: '2026-08-22T13:00:00.000Z',
    }))
  })

  it('reconciles a completed file move when there is no unresolved local queue item', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'file-1',
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      name: 'Project Plan',
      type: 'document',
      folderId: 'folder-b',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    mockUnresolvedSyncQueue([{ id: 'completed', entityId: 'file-1', entityType: 'file', operation: 'update', status: 'completed', retryCount: 0, createdAt: '', updatedAt: '', errorMessage: null }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-doc', name: 'Project.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T13:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ntitle: "Project"\n---\n\nDrive') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).toHaveBeenCalledWith('file-1', expect.objectContaining({
      name: 'Project',
      folderId: null,
      syncStatus: 'backed-up',
      lastSyncedAt: '2026-08-22T13:00:00.000Z',
    }))
  })

  it('keeps pending local file trash when Drive still lists the active file', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'file-1',
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      name: 'Deleted Note',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'pending',
      isDeleted: true,
    }])
    mockUnresolvedSyncQueue([{ id: 'queue-delete', entityId: 'file-1', entityType: 'file', operation: 'delete', status: 'pending', retryCount: 0, createdAt: '', updatedAt: '', errorMessage: null }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-doc', name: 'Deleted Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T13:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).toHaveBeenCalledWith('file-1', {
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      type: 'document',
      mimeType: 'text/markdown',
    })
    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-1', expect.objectContaining({ isDeleted: false }))
  })

  it('does not mark a missing Drive file deleted while a local file operation is unresolved', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'file-1',
      driveFileId: 'drive-doc',
      workspaceType: 'drive',
      name: 'Pending Note',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'text/markdown',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'pending',
      isDeleted: false,
    }])
    mockUnresolvedSyncQueue([{ id: 'queue-file', entityId: 'file-1', entityType: 'file', operation: 'update', status: 'pending', retryCount: 0, createdAt: '', updatedAt: '', errorMessage: null }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-1', expect.objectContaining({ isDeleted: true }))
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('keeps pending local folder move and rename when Drive folder import is stale', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([{
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      name: 'Project Plan',
      parentId: 'folder-b',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      isDeleted: false,
    }])
    mockUnresolvedSyncQueue([{ id: 'queue-folder', entityId: 'folder-1', entityType: 'folder', operation: 'update', status: 'pending', retryCount: 0, createdAt: '', updatedAt: '', errorMessage: null }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-folder', name: 'Project', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.update).not.toHaveBeenCalledWith('folder-1', expect.objectContaining({
      name: 'Project',
      parentId: null,
      isDeleted: false,
    }))
  })

  it('reconciles completed folder move and rename when no local folder operation is unresolved', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([{
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      name: 'Project Plan',
      parentId: 'folder-b',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      isDeleted: false,
    }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-folder', name: 'Project', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.update).toHaveBeenCalledWith('folder-1', expect.objectContaining({
      name: 'Project',
      parentId: null,
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      isDeleted: false,
    }))
  })

  it('keeps pending local folder trash when Drive still lists the active folder', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([{
      id: 'folder-1',
      driveFolderId: 'drive-folder',
      workspaceType: 'drive',
      name: 'Archive',
      parentId: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T12:00:00.000Z',
      isDeleted: true,
    }])
    mockUnresolvedSyncQueue([{ id: 'queue-folder-delete', entityId: 'folder-1', entityType: 'folder', operation: 'delete', status: 'failed', retryCount: 1, createdAt: '', updatedAt: '', errorMessage: 'temporary failure' }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-folder', name: 'Archive', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFoldersToLocal()

    expect(mockedFolders.update).not.toHaveBeenCalledWith('folder-1', expect.objectContaining({ isDeleted: false }))
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

  it('backs up database blocks through the existing MyBook Markdown upload flow', async () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [{
        type: 'databaseBlock',
        attrs: {
          version: 1,
          id: 'db_drive',
          title: 'Drive Tasks',
          columns: [
            { id: 'col_name', name: 'Name', type: 'text' },
            { id: 'col_date', name: 'Due', type: 'date' },
            {
              id: 'col_select',
              name: 'Priority',
              type: 'select',
              options: [
                { id: 'opt_high', label: 'Urgent 😀', color: 'red' },
                { id: 'opt_low', label: 'Low नमस्ते', color: 'orange' },
              ],
            },
            {
              id: 'col_status',
              name: 'Status',
              type: 'status',
              options: [
                { id: 'opt_todo', label: 'Not started', color: 'gray' },
                { id: 'opt_review', label: 'Review مرحبا', color: 'purple' },
                { id: 'opt_done', label: 'Done', color: 'green' },
              ],
            },
            { id: 'col_done', name: 'Done', type: 'checkbox' },
            { id: 'col_number', name: 'Estimate', type: 'number' },
          ],
          rows: [
            { id: 'row_3', values: { col_name: 'QA', col_number: 3, col_select: 'opt_low', col_status: 'opt_review', col_date: '2026-09-20' } },
            { id: 'row_1', values: { col_name: 'Homepage', col_number: -12.5, col_select: 'opt_high', col_status: 'opt_done', col_date: '2026-09-04', col_done: true } },
            { id: 'row_2', values: { col_name: 'Mobile', col_status: 'opt_todo' } },
          ],
          viewState: {
            sort: { columnId: 'col_date', direction: 'desc' },
            filters: [
              { id: 'filter_priority', columnId: 'col_select', operator: 'is', value: 'opt_high' },
              { id: 'filter_done', columnId: 'col_done', operator: 'isChecked' },
            ],
          },
        },
      }],
    })
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFiles.get.mockResolvedValue({
      id: 'file-1',
      driveFileId: null,
      name: 'Database Note',
      type: 'document',
      folderId: null,
      content,
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ id: 'drive-doc', name: 'Database Note.mybook.md', modifiedTime: '2026-08-29T10:00:00.000Z' }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await backupDocumentToDrive({
      fileId: 'file-1',
      title: 'Database Note',
      content,
      folderId: null,
    })

    expect(result.success).toBe(true)
    const uploadBody = fetchMock.mock.calls[0]?.[1]?.body as Blob
    const uploadText = await uploadBody.text()
    expect(uploadText).toContain('document_id: "file-1"')
    expect(uploadText).toContain(':::database')
    expect(uploadText).toContain('"id": "db_drive"')
    expect(uploadText).toContain('"type": "number"')
    expect(uploadText).toContain('"type": "select"')
    expect(uploadText).toContain('"type": "date"')
    expect(uploadText).toContain('"label": "Urgent 😀"')
    expect(uploadText).toContain('"label": "Low नमस्ते"')
    expect(uploadText).toContain('"label": "Review مرحبا"')
    expect(uploadText).toContain('"color": "orange"')
    expect(uploadText).toContain('"color": "purple"')
    expect(uploadText).toContain('"col_number": -12.5')
    expect(uploadText).toContain('"col_select": "opt_high"')
    expect(uploadText).toContain('"col_date": "2026-09-04"')
    expect(uploadText.indexOf('"id": "col_date"')).toBeLessThan(uploadText.indexOf('"id": "col_select"'))
    expect(uploadText.indexOf('"id": "col_done"')).toBeLessThan(uploadText.indexOf('"id": "col_number"'))
    expect(uploadText.indexOf('"id": "row_3"')).toBeLessThan(uploadText.indexOf('"id": "row_1"'))
    expect(uploadText.indexOf('"id": "row_1"')).toBeLessThan(uploadText.indexOf('"id": "row_2"'))
    expect(uploadText).toContain('"viewState"')
    expect(uploadText).toContain('"sort"')
    expect(uploadText).toContain('"columnId": "col_date"')
    expect(uploadText).toContain('"id": "filter_priority"')
    expect(uploadText).toContain('"value": "opt_high"')
  })

  it('does not mark a document synced when local content changes during upload', async () => {
    const beforeUpload = {
      id: 'file-1',
      driveFileId: 'drive-doc',
      name: 'Race Note',
      type: 'document' as const,
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version A"}]}]}',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: '2026-08-29T00:00:00.000Z',
      syncStatus: 'pending' as const,
      isDeleted: false,
    }
    const changedDuringUpload = {
      ...beforeUpload,
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Version B"}]}]}',
      updatedAt: '2026-08-29T00:01:00.000Z',
      syncStatus: 'pending' as const,
    }
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: 'mybook-root', updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFiles.get
      .mockResolvedValueOnce(beforeUpload)
      .mockResolvedValueOnce(beforeUpload)
      .mockResolvedValueOnce(changedDuringUpload)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'drive-doc', name: 'Race Note.mybook.md', modifiedTime: '2026-08-29T10:00:00.000Z' }),
    }))

    const result = await backupDocumentToDrive({
      fileId: 'file-1',
      title: 'Race Note',
      content: beforeUpload.content,
      folderId: null,
    })

    expect(result.success).toBe(true)
    expect(mockedFiles.update).toHaveBeenLastCalledWith('file-1', expect.objectContaining({
      driveFileId: 'drive-doc',
      syncStatus: 'pending',
    }))
    expect(mockedFiles.update).not.toHaveBeenCalledWith('file-1', expect.objectContaining({
      syncStatus: 'backed-up',
      lastSyncedAt: '2026-08-29T10:00:00.000Z',
    }))
  })

  it('restores portable document IDs during a fresh Drive import', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [
        { id: 'drive-a', name: 'Document A.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' },
        { id: 'drive-b', name: 'Document B.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-a"\ntitle: "Document A"\n---\n\nA') })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-b"\ntitle: "Document B"\n---\n\nB') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      id: 'doc-a',
      driveFileId: 'drive-a',
      name: 'Document A',
    }))
    expect(mockedFiles.add).toHaveBeenCalledWith(expect.objectContaining({
      id: 'doc-b',
      driveFileId: 'drive-b',
      name: 'Document B',
    }))
  })

  it('restores two linked documents with stable internal document link targets', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [
        { id: 'drive-a', name: 'Document A.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' },
        { id: 'drive-b', name: 'Document B.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' },
      ] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue([
        '---',
        'mybook_version: 1',
        'type: document',
        'document_id: "doc-a"',
        'title: "Document A"',
        '---',
        '',
        ':::document-link',
        '{',
        '  "targetId": "doc-b",',
        '  "label": "Document B"',
        '}',
        ':::',
      ].join('\n')) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-b"\ntitle: "Document B"\n---\n\nTarget') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    const addedById = new Map(mockedFiles.add.mock.calls.map((call) => [call[0].id, call[0]]))
    expect(addedById.get('doc-a')).toMatchObject({ driveFileId: 'drive-a', name: 'Document A' })
    expect(addedById.get('doc-b')).toMatchObject({ driveFileId: 'drive-b', name: 'Document B' })
    expect(JSON.parse(String(addedById.get('doc-a')?.content))).toMatchObject({
      type: 'doc',
      content: [{
        type: 'documentLink',
        attrs: {
          targetId: 'doc-b',
          label: 'Document B',
        },
      }],
    })
  })

  it('does not let a conflicting imported document_id overwrite an unrelated local file', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'doc-a',
      driveFileId: null,
      name: 'Existing Local',
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
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-other', name: 'Different.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-a"\ntitle: "Different"\n---\n\nDifferent') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.update).not.toHaveBeenCalledWith('doc-a', expect.anything())
    const added = mockedFiles.add.mock.calls[0]?.[0]
    expect(added).toMatchObject({ driveFileId: 'drive-other', name: 'Different' })
    expect(added?.id).not.toBe('doc-a')
  })

  it('keeps existing Drive-mapped local identity ahead of imported document_id metadata', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([{
      id: 'local-existing',
      driveFileId: 'drive-doc',
      name: 'Existing',
      type: 'document',
      folderId: null,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: '2026-08-22T09:00:00.000Z',
      syncStatus: 'backed-up',
      isDeleted: false,
    }])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-doc', name: 'Existing.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ndocument_id: "doc-from-file"\ntitle: "Existing"\n---\n\nUpdated') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    expect(mockedFiles.add).not.toHaveBeenCalled()
    expect(mockedFiles.update).toHaveBeenCalledWith('local-existing', expect.objectContaining({
      driveFileId: 'drive-doc',
      name: 'Existing',
    }))
  })

  it('keeps legacy Drive imports without document_id functional', async () => {
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'drive-legacy', name: 'Legacy.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('---\nmybook_version: 1\ntype: document\ntitle: "Legacy"\n---\n\nLegacy body') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    const added = mockedFiles.add.mock.calls[0]?.[0]
    expect(added).toMatchObject({ driveFileId: 'drive-legacy', name: 'Legacy' })
    expect(added?.id).toBeTypeOf('string')
    expect(added?.id).not.toBe('')
  })

  it('imports database blocks from Drive markdown through the existing import flow', async () => {
    const markdown = [
      '---',
      'mybook_version: 1',
      'type: document',
      'title: "Database Note"',
      '---',
      '',
      ':::database',
      JSON.stringify({
        type: 'databaseBlock',
        attrs: {
          version: 1,
          id: 'db_import',
          title: 'Imported Tasks',
          columns: [
            { id: 'col_name', name: 'Name', type: 'text' },
            { id: 'col_date', name: 'Due', type: 'date' },
            {
              id: 'col_select',
              name: 'Priority',
              type: 'select',
              options: [
                { id: 'opt_high', label: 'Urgent 😀', color: 'red' },
                { id: 'opt_low', label: 'Low नमस्ते', color: 'orange' },
              ],
            },
            {
              id: 'col_status',
              name: 'Status',
              type: 'status',
              options: [
                { id: 'opt_review', label: 'Review مرحبا', color: 'purple' },
                { id: 'opt_done', label: 'Done', color: 'green' },
              ],
            },
            { id: 'col_done', name: 'Done', type: 'checkbox' },
            { id: 'col_number', name: 'Estimate', type: 'number' },
          ],
          rows: [
            { id: 'row_3', values: { col_name: 'QA', col_number: 3, col_select: 'opt_low', col_status: 'opt_review', col_date: '2026-09-20' } },
            { id: 'row_1', values: { col_name: 'Dashboard', col_number: 42, col_select: 'opt_high', col_status: 'opt_done', col_date: '2026-09-04', col_done: false } },
            { id: 'row_2', values: { col_name: 'Mobile' } },
          ],
          viewState: {
            sort: { columnId: 'col_date', direction: 'desc' },
            filters: [
              { id: 'filter_priority', columnId: 'col_select', operator: 'is', value: 'opt_high' },
              { id: 'filter_done', columnId: 'col_done', operator: 'isUnchecked' },
            ],
          },
        },
      }, null, 2),
      ':::',
    ].join('\n')
    mockedSettings.get.mockResolvedValue({ key: 'google-drive.mybook-folder-id', value: null, updatedAt: '2026-07-24T00:00:00.000Z' })
    mockedFolders.toArray.mockResolvedValue([])
    mockedFiles.toArray.mockResolvedValue([])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'root-folder', name: 'MyBook', mimeType: 'application/vnd.google-apps.folder' }] }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [{ id: 'doc-1', name: 'Database Note.mybook.md', mimeType: 'text/markdown', modifiedTime: '2026-08-22T10:00:00.000Z' }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue(markdown) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ files: [] }) }))

    await importDriveFilesToLocal()

    const stored = mockedFiles.add.mock.calls[0]?.[0]?.content
    expect(stored).toBeTypeOf('string')
    expect(JSON.parse(String(stored))).toMatchObject({
      type: 'doc',
      content: [{
        type: 'databaseBlock',
        attrs: {
          id: 'db_import',
          columns: [
            { id: 'col_name', name: 'Name', type: 'text' },
            { id: 'col_date', name: 'Due', type: 'date' },
            {
              id: 'col_select',
              name: 'Priority',
              type: 'select',
              options: [
                { id: 'opt_high', label: 'Urgent 😀', color: 'red' },
                { id: 'opt_low', label: 'Low नमस्ते', color: 'orange' },
              ],
            },
            {
              id: 'col_status',
              name: 'Status',
              type: 'status',
              options: [
                { id: 'opt_review', label: 'Review مرحبا', color: 'purple' },
                { id: 'opt_done', label: 'Done', color: 'green' },
              ],
            },
            { id: 'col_done', name: 'Done', type: 'checkbox' },
            { id: 'col_number', name: 'Estimate', type: 'number' },
          ],
          rows: [
            { id: 'row_3', values: { col_name: 'QA', col_number: 3, col_select: 'opt_low', col_status: 'opt_review', col_date: '2026-09-20' } },
            { id: 'row_1', values: { col_name: 'Dashboard', col_number: 42, col_select: 'opt_high', col_status: 'opt_done', col_date: '2026-09-04', col_done: false } },
            { id: 'row_2', values: { col_name: 'Mobile' } },
          ],
          viewState: {
            sort: { columnId: 'col_date', direction: 'desc' },
            filters: [
              { id: 'filter_priority', columnId: 'col_select', operator: 'is', value: 'opt_high' },
              { id: 'filter_done', columnId: 'col_done', operator: 'isUnchecked' },
            ],
          },
        },
      }],
    })
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
