// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../database/db'
import { exportLocalWorkspaceBackup, importLocalWorkspaceBackup } from './localBackup'
import { remapDocumentLinksInContent } from '../utils/documentLinkRemap'
import type { MyBookFile } from '../types/files'

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

  it('remaps document links for imported files when backup IDs collide with existing workspace IDs', async () => {
    mockRandomIds(['import-root', 'new-doc-a', 'new-doc-b'])
    const now = '2026-09-05T00:00:00.000Z'
    await db.files.add(file({ id: 'doc-b', name: 'Existing B', content: docContent([]), updatedAt: now }))
    const backup = backupFile([
      file({
        id: 'doc-a',
        name: 'Imported A',
        content: docContent([
          documentLink('doc-b', 'Project B'),
        ]),
        updatedAt: now,
      }),
      file({ id: 'doc-b', name: 'Imported B', content: docContent([]), updatedAt: now }),
    ], now)

    const result = await importLocalWorkspaceBackup(backup)

    expect(result).toMatchObject({ success: true, folderId: 'import-root', fileCount: 2 })
    const importedA = await db.files.get('new-doc-a')
    const importedB = await db.files.get('new-doc-b')
    expect(importedB).toMatchObject({ name: 'Imported B' })
    expect(documentLinkTargets(importedA!.content)).toEqual(['new-doc-b'])
    expect(documentLinkTargets((await db.files.get('doc-b'))!.content)).toEqual([])
  })

  it('remaps circular document links after both imported IDs are finalized', async () => {
    mockRandomIds(['import-root', 'new-doc-a', 'new-doc-b'])
    const now = '2026-09-05T00:00:00.000Z'
    await db.files.bulkAdd([
      file({ id: 'doc-a', name: 'Existing A', content: docContent([]), updatedAt: now }),
      file({ id: 'doc-b', name: 'Existing B', content: docContent([]), updatedAt: now }),
    ])
    const backup = backupFile([
      file({ id: 'doc-a', name: 'Imported A', content: docContent([documentLink('doc-b', 'B')]), updatedAt: now }),
      file({ id: 'doc-b', name: 'Imported B', content: docContent([documentLink('doc-a', 'A')]), updatedAt: now }),
    ], now)

    await importLocalWorkspaceBackup(backup)

    expect(documentLinkTargets((await db.files.get('new-doc-a'))!.content)).toEqual(['new-doc-b'])
    expect(documentLinkTargets((await db.files.get('new-doc-b'))!.content)).toEqual(['new-doc-a'])
  })

  it('remaps self-links, multiple links, and nested document links', async () => {
    const idMap = new Map([['doc-a', 'new-doc-a'], ['doc-b', 'new-doc-b'], ['doc-c', 'new-doc-c']])
    const content = docContent([
      documentLink('doc-a', 'Self'),
      {
        type: 'toggleBlock',
        attrs: { title: 'Links', open: true },
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Nested' }] },
          documentLink('doc-b', 'B'),
          documentLink('doc-c', 'C'),
        ],
      },
    ])

    expect(documentLinkTargets(remapDocumentLinksInContent(content, idMap))).toEqual([
      'new-doc-a',
      'new-doc-b',
      'new-doc-c',
    ])
  })

  it('leaves missing targets, malformed links, plain text, code blocks, and database attrs unchanged', () => {
    const idMap = new Map([['doc-b', 'new-doc-b']])
    const content = docContent([
      { type: 'paragraph', content: [{ type: 'text', text: 'plain doc-b should stay text' }] },
      { type: 'codeBlock', content: [{ type: 'text', text: 'documentLink targetId doc-b' }] },
      { type: 'documentLink', attrs: { targetId: 'missing-doc', label: 'Missing' } },
      { type: 'documentLink', attrs: { targetId: '', label: 'Empty' } },
      { type: 'databaseBlock', attrs: { id: 'db-1', title: 'doc-b' } },
    ])

    const remapped = remapDocumentLinksInContent(content, idMap)

    expect(documentLinkTargets(remapped)).toEqual(['missing-doc', ''])
    expect(remapped).toContain('plain doc-b should stay text')
    expect(remapped).toContain('documentLink targetId doc-b')
    expect(remapped).toContain('"title":"doc-b"')
  })

  it('leaves malformed document content unchanged instead of crashing', () => {
    expect(remapDocumentLinksInContent('{ not json', new Map([['doc-a', 'new-doc-a']]))).toBe('{ not json')
  })

  it('does not parse or modify imported spreadsheet content', async () => {
    mockRandomIds(['import-root', 'new-sheet'])
    const now = '2026-09-05T00:00:00.000Z'
    const spreadsheetContent = JSON.stringify({ sheets: [{ title: 'doc-b' }], node: { type: 'documentLink', attrs: { targetId: 'doc-b' } } })
    const backup = backupFile([
      file({
        id: 'sheet-1',
        name: 'Budget',
        type: 'spreadsheet',
        content: spreadsheetContent,
        mimeType: 'application/x-mybook-spreadsheet',
        updatedAt: now,
      }),
    ], now)

    await importLocalWorkspaceBackup(backup)

    expect((await db.files.get('new-sheet'))?.content).toBe(spreadsheetContent)
  })
})

function mockRandomIds(ids: string[]) {
  let index = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => (ids[index++] ?? `generated-${index}-0000-4000-8000-000000000000`) as ReturnType<Crypto['randomUUID']>)
}

function backupFile(files: MyBookFile[], exportedAt: string) {
  return new File([JSON.stringify({
    kind: 'mybook-workspace-backup',
    version: 1,
    exportedAt,
    folders: [],
    files,
    fileVersions: [],
  })], 'backup.mybook-backup.json', { type: 'application/json' })
}

function file(overrides: Partial<MyBookFile>): MyBookFile {
  return {
    id: 'doc-a',
    driveFileId: null,
    workspaceType: 'local',
    name: 'Document',
    type: 'document',
    folderId: null,
    content: docContent([]),
    mimeType: 'application/x-mybook-document',
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
    lastSyncedAt: null,
    syncStatus: 'local',
    isDeleted: false,
    ...overrides,
  }
}

function docContent(content: unknown[]) {
  return JSON.stringify({ type: 'doc', content })
}

function documentLink(targetId: string, label: string) {
  return { type: 'documentLink', attrs: { targetId, label } }
}

function documentLinkTargets(content: string) {
  const parsed = JSON.parse(content) as { content?: Array<{ type?: string; attrs?: { targetId?: string }; content?: unknown[] }> }
  const targets: string[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== 'object') return
    const node = value as { type?: string; attrs?: { targetId?: string }; content?: unknown[] }
    if (node.type === 'documentLink') targets.push(node.attrs?.targetId ?? '')
    visit(node.content)
  }
  visit(parsed.content)
  return targets
}
