import type { JSONContent } from '@tiptap/core'
import type { MyBookFile, MyBookFolder } from '../../types/files'

export interface DocumentLinkAttrs {
  label: string
  targetId: string
}

export function isValidDocumentLinkAttrs(value: unknown): value is DocumentLinkAttrs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const attrs = value as Record<string, unknown>
  return typeof attrs.targetId === 'string' && attrs.targetId.trim().length > 0
    && typeof attrs.label === 'string' && attrs.label.trim().length > 0
}

export function normalizeDocumentLinkAttrs(value: unknown): DocumentLinkAttrs | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const attrs = value as Record<string, unknown>
  const targetId = typeof attrs.targetId === 'string' ? attrs.targetId.trim() : ''
  const label = typeof attrs.label === 'string' ? attrs.label.trim() : ''
  if (!targetId || !label) return null
  return { targetId, label }
}

export function documentLinkNode(attrs: DocumentLinkAttrs): JSONContent {
  return { type: 'documentLink', attrs }
}

export function pastedDocumentLink(html: string) {
  if (!html) return null
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const element = doc.body.querySelector('[data-type="document-link"]')
    if (element) {
      const targetId = element.getAttribute('data-target-id') ?? element.getAttribute('targetId') ?? ''
      const label = element.getAttribute('data-label') ?? element.getAttribute('label') ?? element.textContent ?? ''
      if (targetId.trim()) {
        return { type: 'documentLink', attrs: { targetId: targetId.trim(), label: label.trim() || 'Document' } }
      }
    }
  }
  const match = /data-type=["']document-link["'][^>]*data-target-id=["']([^"']+)["']/i.exec(html)
    ?? /data-target-id=["']([^"']+)["'][^>]*data-type=["']document-link["']/i.exec(html)
  if (match) {
    const targetId = match[1]?.trim()
    const labelMatch = /data-label=["']([^"']*)["']/i.exec(html)
    const label = labelMatch?.[1]?.trim() || 'Document'
    if (targetId) return { type: 'documentLink', attrs: { targetId, label } }
  }
  return null
}

export function documentLinkTargets(files: MyBookFile[], currentFileId: string, query = '') {
  const normalized = query.trim().toLocaleLowerCase()
  return files
    .filter((item) => ['document', 'spreadsheet'].includes(item.type) && item.id !== currentFileId && !item.isDeleted)
    .filter((item) => !normalized || item.name.toLocaleLowerCase().includes(normalized))
}

export function documentLinkPath(file: MyBookFile, folders: MyBookFolder[]) {
  const names: string[] = []
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  const visited = new Set<string>()
  let folderId = file.folderId

  while (folderId && !visited.has(folderId)) {
    visited.add(folderId)
    const folder = foldersById.get(folderId)
    if (!folder || folder.isDeleted) break
    names.unshift(folder.name)
    folderId = folder.parentId
  }

  return ['Root', ...names, file.name]
}

export function documentLinkLocation(file: MyBookFile, folders: MyBookFolder[], maxLength = 56) {
  const parts = documentLinkPath(file, folders)
  const fullPath = parts.join(' / ')
  if (fullPath.length <= maxLength) return { fullPath, displayPath: fullPath, isTruncated: false }

  const tail: string[] = [parts.at(-1)!]
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const part = parts[index]
    if (!part) continue
    const candidate = [part, ...tail].join(' / ')
    if (`... / ${candidate}`.length > maxLength) break
    tail.unshift(part)
  }
  return { fullPath, displayPath: `... / ${tail.join(' / ')}`, isTruncated: true }
}
