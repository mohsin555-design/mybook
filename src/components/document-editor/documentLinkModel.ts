import type { JSONContent } from '@tiptap/core'
import type { MyBookFile } from '../../types/files'

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

export function documentLinkTargets(files: MyBookFile[], currentFileId: string, query = '') {
  const normalized = query.trim().toLocaleLowerCase()
  return files
    .filter((item) => item.type === 'document' && item.id !== currentFileId && !item.isDeleted)
    .filter((item) => !normalized || item.name.toLocaleLowerCase().includes(normalized))
}
