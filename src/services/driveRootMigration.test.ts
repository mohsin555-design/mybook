import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../database/db'
import { ensureMyBookDriveFolder } from './googleDrive'

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ getAccessToken: async () => 'token' }) },
}))

const key = 'google-drive.mybook-folder-id'
const mimeType = 'application/vnd.google-apps.folder'
const folder = (name = 'MyBook', id = 'existing-root') => ({ id, name, mimeType, trashed: false })
const response = (data: unknown) => ({ ok: true, json: async () => data })
const denied = (status = 403) => ({ ok: false, status, json: async () => ({ error: { message: 'Drive unavailable' } }) })

async function remember(id = 'existing-root') {
  await db.settings.put({ key, value: id, updatedAt: new Date().toISOString() })
}

function mutations(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method)
}

describe('Writin Drive root migration', () => {
  beforeEach(async () => {
    await db.settings.clear()
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renames the saved folder using only its ID and name metadata', async () => {
    await remember()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(folder()))
      .mockResolvedValueOnce(response(folder('Writin')))
    vi.stubGlobal('fetch', fetchMock)

    expect(await ensureMyBookDriveFolder()).toEqual({ success: true, folderId: 'existing-root', folderName: 'Writin', created: false })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mutations(fetchMock)).toEqual([[expect.stringContaining('/files/existing-root?'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Writin' }) })]])
    expect((await db.settings.get(key))?.value).toBe('existing-root')
  })

  it('is idempotent for an already-renamed stored folder', async () => {
    await remember()
    const fetchMock = vi.fn().mockResolvedValue(response(folder('Writin')))
    vi.stubGlobal('fetch', fetchMock)
    expect((await ensureMyBookDriveFolder()).success).toBe(true)
    expect((await ensureMyBookDriveFolder()).success).toBe(true)
    expect(mutations(fetchMock)).toEqual([])
  })

  it.each(['MyBook', 'MYbook', 'Mybook', 'MYBOOK', 'mybook'])('discovers and renames %s on a fresh browser without copying files', async (name) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ files: [folder(name)] }))
      .mockResolvedValueOnce(response(folder('Writin')))
    vi.stubGlobal('fetch', fetchMock)
    expect(await ensureMyBookDriveFolder()).toMatchObject({ success: true, folderId: 'existing-root', created: false })
    const query = new URL(fetchMock.mock.calls[0]![0]).searchParams.get('q')
    expect(query).toContain("name='Writin'")
    expect(query).toContain(`name='${name}'`)
    expect(mutations(fetchMock).map(([, init]) => init.method)).toEqual(['PATCH'])
    expect((await db.settings.get(key))?.value).toBe('existing-root')
  })

  it('reuses Writin discovered on another device without renaming or creating', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ files: [folder('Writin')] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await ensureMyBookDriveFolder()).toMatchObject({ success: true, folderId: 'existing-root', created: false })
    expect(mutations(fetchMock)).toEqual([])
  })

  it('creates Writin only after a successful, empty discovery', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ files: [] }))
      .mockResolvedValueOnce(response(folder('Writin', 'new-root')))
    vi.stubGlobal('fetch', fetchMock)
    expect(await ensureMyBookDriveFolder()).toEqual({ success: true, folderId: 'new-root', folderName: 'Writin', created: true })
    expect(mutations(fetchMock)).toEqual([[expect.any(String), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Writin', mimeType, parents: ['root'] }) })]])
    expect((await db.settings.get(key))?.value).toBe('new-root')
  })

  it('reads later search pages before deciding to create', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ files: [], nextPageToken: 'next-page' }))
      .mockResolvedValueOnce(response({ files: [folder('Writin')] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await ensureMyBookDriveFolder()).toMatchObject({ success: true, folderId: 'existing-root', created: false })
    expect(new URL(fetchMock.mock.calls[1]![0]).searchParams.get('pageToken')).toBe('next-page')
    expect(mutations(fetchMock)).toEqual([])
  })

  it.each([401, 403, 404, 500])('never replaces an inaccessible saved root after HTTP %s', async (status) => {
    await remember()
    const fetchMock = vi.fn().mockResolvedValue(denied(status))
    vi.stubGlobal('fetch', fetchMock)
    expect((await ensureMyBookDriveFolder()).success).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mutations(fetchMock)).toEqual([])
    expect((await db.settings.get(key))?.value).toBe('existing-root')
  })

  it.each([{ ...folder(), trashed: true }, { ...folder(), mimeType: 'text/plain' }])('does not replace a trashed or invalid saved root', async (metadata) => {
    await remember()
    const fetchMock = vi.fn().mockResolvedValue(response(metadata))
    vi.stubGlobal('fetch', fetchMock)
    expect((await ensureMyBookDriveFolder()).success).toBe(false)
    expect(mutations(fetchMock)).toEqual([])
  })

  it.each([
    { files: [], incompleteSearch: true },
    {},
    { files: [{ id: 'existing-root', name: 'MyBook' }] },
    { files: [folder(), folder('Writin', 'other-root')] },
  ])('does not create or merge when discovery is incomplete or ambiguous: %j', async (data) => {
    const fetchMock = vi.fn().mockResolvedValue(response(data))
    vi.stubGlobal('fetch', fetchMock)
    expect((await ensureMyBookDriveFolder()).success).toBe(false)
    expect(mutations(fetchMock)).toEqual([])
    expect(await db.settings.get(key)).toBeUndefined()
  })

  it('does not treat an offline search as an empty workspace', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await ensureMyBookDriveFolder()).toMatchObject({ success: false, error: expect.stringMatching(/offline/i) })
    expect(mutations(fetchMock)).toEqual([])
  })

  it('keeps a discovered ID after a denied rename and retries that same folder', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ files: [folder()] }))
      .mockResolvedValueOnce(denied())
      .mockResolvedValueOnce(response(folder()))
      .mockResolvedValueOnce(response(folder('Writin')))
    vi.stubGlobal('fetch', fetchMock)
    expect((await ensureMyBookDriveFolder()).success).toBe(false)
    expect((await db.settings.get(key))?.value).toBe('existing-root')
    expect(await ensureMyBookDriveFolder()).toMatchObject({ success: true, folderId: 'existing-root', created: false })
    expect(mutations(fetchMock).map(([, init]) => init.method)).toEqual(['PATCH', 'PATCH'])
  })

  it('honors a stored folder identity without searching for other similarly named folders', async () => {
    await remember('chosen-root')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(folder('MyBook', 'chosen-root')))
      .mockResolvedValueOnce(response(folder('Writin', 'chosen-root')))
    vi.stubGlobal('fetch', fetchMock)
    expect(await ensureMyBookDriveFolder()).toMatchObject({ success: true, folderId: 'chosen-root' })
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('/files/chosen-root?'))).toBe(true)
  })

  it('coalesces concurrent setup calls so only one folder is created', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ files: [] }))
      .mockResolvedValueOnce(response(folder('Writin', 'new-root')))
    vi.stubGlobal('fetch', fetchMock)
    const results = await Promise.all([ensureMyBookDriveFolder(), ensureMyBookDriveFolder(), ensureMyBookDriveFolder()])
    expect(results.every((result) => result.success && result.folderId === 'new-root')).toBe(true)
    expect(mutations(fetchMock)).toHaveLength(1)
  })

  it('uses a browser lock when available to serialize setup across tabs', async () => {
    const request = vi.fn(async (_name: string, callback: () => Promise<unknown>) => callback())
    vi.stubGlobal('navigator', { onLine: true, locks: { request } })
    await remember()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(folder('Writin'))))
    expect((await ensureMyBookDriveFolder()).success).toBe(true)
    expect(request).toHaveBeenCalledWith('mybook-drive-root-setup', expect.any(Function))
  })
})
