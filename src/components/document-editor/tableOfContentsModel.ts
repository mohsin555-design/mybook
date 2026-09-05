import type { JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface TableOfContentsEntry {
  id: string
  level: 1 | 2 | 3
  pos: number
  text: string
}

export function plainTextFromJsonContent(content: JSONContent[] | undefined): string {
  return (content ?? []).map((node) => {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'hardBreak') return ' '
    return plainTextFromJsonContent(node.content)
  }).join('')
}

export function tableOfContentsNode() {
  return { type: 'tableOfContents' }
}

export function getTableOfContentsEntries(doc: ProseMirrorNode): TableOfContentsEntry[] {
  const entries: TableOfContentsEntry[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return true
    const level = Number(node.attrs.level)
    if (level !== 1 && level !== 2 && level !== 3) return false
    const text = node.textContent.trim()
    if (!text) return false
    entries.push({
      id: `toc-${pos}-${entries.length}`,
      level,
      pos,
      text,
    })
    return false
  })
  return entries
}
