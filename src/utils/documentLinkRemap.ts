import type { JSONContent } from '@tiptap/core'

export function remapDocumentLinksInContent(content: string, idMap: ReadonlyMap<string, string>) {
  if (!idMap.size) return content
  try {
    const parsed = JSON.parse(content) as unknown
    const remapped = remapDocumentLinksInTiptapJson(parsed, idMap)
    return remapped.changed ? JSON.stringify(remapped.value) : content
  } catch {
    return content
  }
}

export function remapDocumentLinksInTiptapJson(value: unknown, idMap: ReadonlyMap<string, string>): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false
    const items = value.map((item) => {
      const remapped = remapDocumentLinksInTiptapJson(item, idMap)
      changed ||= remapped.changed
      return remapped.value
    })
    return { value: changed ? items : value, changed }
  }

  if (!value || typeof value !== 'object') return { value, changed: false }

  const node = value as JSONContent
  let changed = false
  let nextNode = node

  if (node.type === 'documentLink' && node.attrs && typeof node.attrs.targetId === 'string') {
    const mappedTargetId = idMap.get(node.attrs.targetId)
    if (mappedTargetId && mappedTargetId !== node.attrs.targetId) {
      nextNode = {
        ...node,
        attrs: {
          ...node.attrs,
          targetId: mappedTargetId,
        },
      }
      changed = true
    }
  }

  if (Array.isArray(nextNode.content)) {
    const remappedContent = remapDocumentLinksInTiptapJson(nextNode.content, idMap)
    if (remappedContent.changed) {
      nextNode = {
        ...nextNode,
        content: remappedContent.value as JSONContent[],
      }
      changed = true
    }
  }

  return { value: nextNode, changed }
}
