import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../database/db'
import {
  cleanDocumentName,
  documentMarkdown,
  isAttachmentDirectoryName,
  sanitizeFileName,
  scanAndHydrateLocalWorkspace,
} from './localWorkspace'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

describe('localWorkspace service', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    useWorkspaceStore.setState({ mode: 'local' })
  })

  it('sanitizes illegal file system characters safely', () => {
    expect(sanitizeFileName('My Document: Chapter 1 / Draft *?')).toBe('My Document_ Chapter 1 _ Draft __')
    expect(sanitizeFileName('')).toBe('Untitled')
  })

  it('cleans document file extensions properly', () => {
    expect(cleanDocumentName('Holiday.mybook.md')).toBe('Holiday')
    expect(cleanDocumentName('Notes.md')).toBe('Notes')
    expect(cleanDocumentName('Budget.xlsx')).toBe('Budget')
    expect(cleanDocumentName('12345.content.json')).toBe('12345')
  })

  it('converts document content to portable markdown with documentId metadata', () => {
    const markdown = documentMarkdown({
      id: 'doc-uuid-123',
      name: 'Meeting',
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Discussion points' }] }],
      }),
    })
    expect(markdown).toContain('Discussion points')
    expect(markdown).toContain('document_id: "doc-uuid-123"')
    expect(markdown).toContain('title: "Meeting"')
  })

  it('converts empty document to clean frontmatter without automatic # Untitled heading', () => {
    const markdown = documentMarkdown({
      id: 'doc-empty-456',
      name: 'Untitled',
      content: '',
    })
    expect(markdown).toContain('title: "Untitled"')
    expect(markdown).toContain('document_id: "doc-empty-456"')
    expect(markdown).not.toContain('# Untitled')
  })

  it('identifies attachment folder names correctly', () => {
    expect(isAttachmentDirectoryName('Notes_attachments')).toBe(true)
    expect(isAttachmentDirectoryName('Notes-attachments')).toBe(true)
    expect(isAttachmentDirectoryName('Notes.attachments')).toBe(true)
    expect(isAttachmentDirectoryName('NormalFolder')).toBe(false)
  })

  it('scans mock directory handle, ignores attachment folders, and restores files to database', async () => {
    const fileEntries = new Map<string, FileSystemHandle>([
      [
        'Shopping.md',
        {
          kind: 'file',
          name: 'Shopping.md',
          getFile: async () => ({
            text: async () => '# Shopping\n\n- [ ] Milk\n- [ ] Apples',
            lastModified: Date.now(),
          }),
        } as unknown as FileSystemHandle,
      ],
      [
        'Finance.xlsx',
        {
          kind: 'file',
          name: 'Finance.xlsx',
          getFile: async () => ({
            text: async () => 'mock-xlsx-data',
            lastModified: Date.now(),
          }),
        } as unknown as FileSystemHandle,
      ],
    ])

    const mockRootHandle = {
      kind: 'directory',
      name: 'MockRoot',
      getDirectoryHandle: vi.fn().mockRejectedValue(new Error('No Writin folder')),
      entries: async function* () {
        for (const entry of fileEntries.entries()) {
          yield entry
        }
      },
    } as unknown as FileSystemDirectoryHandle

    const { discoveredCount, restoredCount } = await scanAndHydrateLocalWorkspace(mockRootHandle)
    expect(discoveredCount).toBe(2)
    expect(restoredCount).toBe(2)

    const files = await db.files.toArray()
    expect(files.length).toBe(2)
    const shoppingFile = files.find((f) => f.name === 'Shopping')
    expect(shoppingFile).toBeDefined()
    expect(shoppingFile?.type).toBe('document')
    expect(shoppingFile?.workspaceType).toBe('local')
  })
})
