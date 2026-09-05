import { describe, expect, it } from 'vitest'

import type { MyBookFile } from '../../types/files'
import { documentLinkNode, documentLinkTargets, normalizeDocumentLinkAttrs } from './documentLinkModel'

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

  it('lists eligible picker targets by stable document id', () => {
    const targets = documentLinkTargets([
      file('current', 'Current'),
      file('doc_a', 'Project Notes'),
      file('doc_b', 'Project Notes'),
      file('sheet_a', 'Project Spreadsheet', 'spreadsheet'),
      file('trashed', 'Deleted Notes', 'document', true),
    ], 'current')

    expect(targets.map((target) => target.id)).toEqual(['doc_a', 'doc_b'])
  })

  it('searches picker targets by title without requiring unique names', () => {
    const targets = documentLinkTargets([
      file('doc_a', 'Project Notes'),
      file('doc_b', 'Project Plan'),
      file('doc_c', 'Archive'),
    ], 'current', 'project')

    expect(targets.map((target) => target.id)).toEqual(['doc_a', 'doc_b'])
  })
})
