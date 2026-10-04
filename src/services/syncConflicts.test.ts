import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../database/db'
import type { MyBookFile } from '../types/files'
import { applyRemoteVersion, keepLocalVersion, recordRemoteConflict } from './syncConflicts'

const file = (overrides: Partial<MyBookFile> = {}): MyBookFile => ({
  id: 'file-1', driveFileId: 'drive-1', name: 'Doc', type: 'document', folderId: null, content: 'local edit', baseContent: 'base',
  mimeType: 'application/x-mybook-document', createdAt: '2026-10-03T10:00:00.000Z', updatedAt: '2026-10-03T10:00:00.000Z',
  lastSyncedAt: '2026-10-03T11:00:00.000Z', syncStatus: 'pending', isDeleted: false, ...overrides,
})

describe('sync conflicts', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.files.add(file())
  })

  it('records the remote content as a version without touching local content', async () => {
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')

    const stored = await db.files.get('file-1')
    expect(stored?.content).toBe('local edit')
    expect(stored?.syncConflict?.remoteModifiedTime).toBe('2026-10-03T12:00:00.000Z')
    expect((await db.fileVersions.get(stored!.syncConflict!.versionId))?.content).toBe('remote edit')
  })

  it('does not record the same remote version twice', async () => {
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    expect(await db.fileVersions.count()).toBe(1)
  })

  it('keeps local edits, acknowledges the remote version and queues a push', async () => {
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    await keepLocalVersion('file-1')

    const stored = await db.files.get('file-1')
    expect(stored).toMatchObject({ content: 'local edit', syncConflict: null, syncStatus: 'pending', lastSyncedAt: '2026-10-03T12:00:00.000Z' })
  })

  it('uses the remote version on request and preserves the local one in history', async () => {
    await recordRemoteConflict('file-1', 'remote edit', '2026-10-03T12:00:00.000Z')
    expect(await applyRemoteVersion('file-1')).toBe(true)

    const stored = await db.files.get('file-1')
    expect(stored).toMatchObject({ content: 'remote edit', baseContent: 'remote edit', syncConflict: null, syncStatus: 'backed-up' })
    const versions = await db.fileVersions.toArray()
    expect(versions.some((version) => version.content === 'local edit' && version.label === 'Before using remote version')).toBe(true)
  })
})
