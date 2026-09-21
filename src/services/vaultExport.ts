import type { JSONContent } from '@tiptap/core'
import { db } from '../database/db'
import type { MyBookFile, MyBookFolder } from '../types/files'
import { documentToMyBookMarkdown } from '../utils/mybookMarkdown'
import { createZipArchive, type ZipEntry } from '../utils/zip'
import { isLocalWorkspace } from '../stores/useWorkspaceStore'
import { mimeToExtension, parseDataUrl, sanitizeFileName } from './localWorkspace'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function exportDocumentToMarkdown(file: Pick<MyBookFile, 'id' | 'name' | 'content'>): string {
  try {
    const json = JSON.parse(file.content) as JSONContent
    return documentToMyBookMarkdown(file.name, json, { documentId: file.id })
  } catch {
    return file.content || `# ${file.name}\n`
  }
}

export function exportDocumentWithAttachments(
  file: Pick<MyBookFile, 'id' | 'name' | 'content'>,
  folderPath = ''
): { markdown: string; attachmentEntries: ZipEntry[] } {
  const attachmentEntries: ZipEntry[] = []
  try {
    const json = JSON.parse(file.content) as JSONContent
    const cloned = JSON.parse(JSON.stringify(json)) as JSONContent
    const cleanBaseName = sanitizeFileName(file.name)
    let mediaCounter = 0

    function processNode(node: JSONContent) {
      if (
        (node.type === 'imageBlock' || node.type === 'videoBlock' || node.type === 'audioBlock' || node.type === 'fileAttachment') &&
        typeof node.attrs?.src === 'string'
      ) {
        const src = node.attrs.src.trim()
        if (src.startsWith('data:')) {
          const parsed = parseDataUrl(src)
          if (parsed) {
            mediaCounter += 1
            const ext = mimeToExtension(parsed.mimeType)
            let fileName = ''
            if (node.type === 'fileAttachment' && typeof node.attrs.name === 'string' && node.attrs.name.trim()) {
              fileName = sanitizeFileName(node.attrs.name.trim())
              if (!fileName.includes('.')) fileName = `${fileName}.${ext}`
            } else {
              fileName = `media_${mediaCounter}.${ext}`
            }
            const attachmentPath = `${folderPath}${cleanBaseName}_attachments/${fileName}`
            attachmentEntries.push({ path: attachmentPath, data: parsed.data })
            node.attrs.src = `./${cleanBaseName}_attachments/${fileName}`
          }
        }
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          processNode(child)
        }
      }
    }

    processNode(cloned)
    const markdown = documentToMyBookMarkdown(file.name, cloned, { documentId: file.id })
    return { markdown, attachmentEntries }
  } catch {
    return {
      markdown: file.content || `# ${file.name}\n`,
      attachmentEntries: [],
    }
  }
}

export function downloadDocumentMarkdown(file: Pick<MyBookFile, 'id' | 'name' | 'content'>) {
  const markdown = exportDocumentToMarkdown(file)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const sanitizedName = (file.name.trim() || 'Untitled').replace(/[\\/:*?"<>|]/g, '_')
  triggerDownload(blob, `${sanitizedName}.md`)
}

function activeItemBelongsToWorkspace(item: { workspaceType?: string; syncStatus?: string; driveFileId?: string | null }) {
  if (isLocalWorkspace()) {
    return item.workspaceType === 'local' || (!item.workspaceType && item.syncStatus === 'local' && !item.driveFileId)
  }
  return item.workspaceType !== 'local'
}

function buildFolderPath(folderId: string | null, foldersById: Map<string, MyBookFolder>): string {
  if (!folderId) return ''
  const segments: string[] = []
  let currentId: string | null = folderId
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const folder = foldersById.get(currentId)
    if (!folder) break
    const cleanName = folder.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Folder'
    segments.unshift(cleanName)
    currentId = folder.parentId
  }

  return segments.length > 0 ? `${segments.join('/')}/` : ''
}

export async function exportVaultZip({
  vaultName = 'My Workspace',
  folderId = null,
}: {
  vaultName?: string
  folderId?: string | null
} = {}): Promise<{ blob: Blob; fileName: string; fileCount: number }> {
  const allFolders = (await db.folders.toArray()).filter((f) => !f.isDeleted && activeItemBelongsToWorkspace(f))
  const allFiles = (await db.files.toArray()).filter((f) => !f.isDeleted && activeItemBelongsToWorkspace(f))

  const foldersById = new Map(allFolders.map((f) => [f.id, f]))

  let targetFiles = allFiles
  let baseFolderPrefix = ''

  if (folderId) {
    const targetSubtreeIds = new Set([folderId])
    let changed = true
    while (changed) {
      changed = false
      for (const f of allFolders) {
        if (f.parentId && targetSubtreeIds.has(f.parentId) && !targetSubtreeIds.has(f.id)) {
          targetSubtreeIds.add(f.id)
          changed = true
        }
      }
    }
    targetFiles = allFiles.filter((f) => f.folderId && targetSubtreeIds.has(f.folderId))
    const rootFolder = foldersById.get(folderId)
    baseFolderPrefix = buildFolderPath(rootFolder?.parentId ?? null, foldersById)
  }

  const entries: ZipEntry[] = []

  for (const file of targetFiles) {
    let folderPath = buildFolderPath(file.folderId, foldersById)
    if (baseFolderPrefix && folderPath.startsWith(baseFolderPrefix)) {
      folderPath = folderPath.slice(baseFolderPrefix.length)
    }

    const cleanBaseName = (file.name.trim() || (file.type === 'spreadsheet' ? 'Untitled Spreadsheet' : 'Untitled')).replace(/[\\/:*?"<>|]/g, '_')
    const extension = file.type === 'spreadsheet' ? '.xlsx' : '.md'
    const filePath = `${folderPath}${cleanBaseName}${extension}`

    if (file.type === 'spreadsheet') {
      entries.push({ path: filePath, data: file.content || '' })
    } else {
      const { markdown, attachmentEntries } = exportDocumentWithAttachments(file, folderPath)
      entries.push({ path: filePath, data: markdown })
      entries.push(...attachmentEntries)
    }
  }

  const zipBlob = await createZipArchive(entries)
  const safeVaultName = (vaultName.trim() || 'My-Workspace').replace(/[\\/:*?"<>|]/g, '_')
  const fileName = `${safeVaultName}.zip`

  return { blob: zipBlob, fileName, fileCount: entries.length }
}

export async function downloadVaultZip(options?: { vaultName?: string; folderId?: string | null }) {
  const { blob, fileName } = await exportVaultZip(options)
  triggerDownload(blob, fileName)
}

