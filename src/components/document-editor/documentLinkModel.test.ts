import { describe, expect, it } from 'vitest'

import type { MyBookFile, MyBookFolder } from '../../types/files'
import { documentLinkLocation, documentLinkNode, documentLinkTargets, normalizeDocumentLinkAttrs } from './documentLinkModel'

function file(id: string, name: string, type: MyBookFile['type'] = 'document', isDeleted = false): MyBookFile {
  return {
    id,
    driveFileId: null,
    workspaceType: 'local',
    name,
    type,
    folderId: null,
    content: '',
    mimeType: type === 'document' ? 'application/x-mybook-document' : 'application/x-mybook-spreadsheet',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
    lastSyncedAt: null,
    syncStatus: 'local',
    isDeleted,
  }
}

function folder(id: string, name: string, parentId: string | null): MyBookFolder {
  return {
    id,
    driveFolderId: null,
    workspaceType: 'local',
    name,
    parentId,
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
    isDeleted: false,
  }
}

describe('document link model', () => {
  it('creates a persisted document link node with target identity and fallback label', () => {
    expect(documentLinkNode({ targetId: 'doc_b', label: 'Project Notes' })).toEqual({
      type: 'documentLink',
      attrs: { targetId: 'doc_b', label: 'Project Notes' },
    })
  })

  it('normalizes valid attrs without resolving identity by title', () => {
    expect(normalizeDocumentLinkAttrs({ targetId: ' doc_b ', label: ' Project Notes ' })).toEqual({
      targetId: 'doc_b',
      label: 'Project Notes',
    })
  })

  it('rejects malformed attrs safely', () => {
    expect(normalizeDocumentLinkAttrs({ targetId: '', label: 'Project Notes' })).toBeNull()
    expect(normalizeDocumentLinkAttrs({ targetId: 'doc_b', label: '' })).toBeNull()
    expect(normalizeDocumentLinkAttrs(null)).toBeNull()
  })

  it('lists eligible picker targets by stable page id', () => {
    const targets = documentLinkTargets([
      file('current', 'Current'),
      file('doc_a', 'Project Notes'),
      file('doc_b', 'Project Notes'),
      file('sheet_a', 'Project Spreadsheet', 'spreadsheet'),
      file('trashed', 'Deleted Notes', 'document', true),
    ], 'current')

    expect(targets.map((target) => target.id)).toEqual(['doc_a', 'doc_b', 'sheet_a'])
  })

  it('searches picker targets by title without requiring unique names', () => {
    const targets = documentLinkTargets([
      file('doc_a', 'Project Notes'),
      file('doc_b', 'Project Plan'),
      file('doc_c', 'Archive'),
    ], 'current', 'project')

    expect(targets.map((target) => target.id)).toEqual(['doc_a', 'doc_b'])
  })

  it('formats root and nested locations and truncates from the beginning', () => {
    const folders = [folder('one', 'Folder 1', null), folder('two', 'Folder 2', 'one'), folder('three', 'Folder 3', 'two')]
    expect(documentLinkLocation(file('root', 'Home'), []).displayPath).toBe('Root / Home')
    expect(documentLinkLocation({ ...file('nested', 'File name'), folderId: 'three' }, folders, 32)).toEqual({
      fullPath: 'Root / Folder 1 / Folder 2 / Folder 3 / File name',
      displayPath: '... / Folder 3 / File name',
      isTruncated: true,
    })
  })
})
