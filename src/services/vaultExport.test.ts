import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../database/db'
import { exportDocumentToMarkdown, exportVaultZip } from './vaultExport'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

describe('vaultExport', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    useWorkspaceStore.setState({ mode: 'local' })
  })

  it('exports document JSON content to clean Markdown string', () => {
    const docJson = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    }
    const md = exportDocumentToMarkdown({
      id: 'doc-1',
      name: 'My Document',
      content: JSON.stringify(docJson),
    })
    expect(md).toContain('Hello world')
  })

  it('exports entire vault structure into a zip blob', async () => {
    const folderId = crypto.randomUUID()
    await db.folders.add({
      id: folderId,
      name: 'Work',
      parentId: null,
      workspaceType: 'local',
      driveFolderId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    })

    await db.files.add({
      id: crypto.randomUUID(),
      name: 'Notes',
      type: 'document',
      folderId,
      workspaceType: 'local',
      driveFileId: null,
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Project notes' }] }],
      }),
      mimeType: 'application/x-mybook-document',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: false,
    })

    const { blob, fileName, fileCount } = await exportVaultZip({ vaultName: 'Personal Vault' })
    expect(fileCount).toBe(1)
    expect(fileName).toBe('Personal Vault.zip')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('extracts base64 media into companion _attachments entries during zip export', async () => {
    const docJson = {
      type: 'doc',
      content: [
        {
          type: 'imageBlock',
          attrs: {
            src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            alt: 'Test Pixel',
          },
        },
      ],
    }

    await db.files.add({
      id: crypto.randomUUID(),
      name: 'Holiday',
      type: 'document',
      folderId: null,
      workspaceType: 'local',
      driveFileId: null,
      content: JSON.stringify(docJson),
      mimeType: 'application/x-mybook-document',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: false,
    })

    const { fileName, fileCount } = await exportVaultZip({ vaultName: 'Holiday Vault' })
    expect(fileName).toBe('Holiday Vault.zip')
    expect(fileCount).toBe(2) // 1 markdown file + 1 companion attachment file
  })
})
