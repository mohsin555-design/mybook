import type { JSONContent } from '@tiptap/core'

export interface DocumentMergeResult {
  success: boolean
  content: string
  hasConflict?: boolean
}

function serializeNode(node: JSONContent): string {
  try {
    return JSON.stringify(node)
  } catch {
    return ''
  }
}

/**
 * 3-way merge for Tiptap JSONContent block lists.
 * Preserves edits made on different blocks by local and remote devices.
 */
function mergeTiptapBlocks(
  baseBlocks: JSONContent[],
  localBlocks: JSONContent[],
  remoteBlocks: JSONContent[]
): { blocks: JSONContent[]; hasConflict: boolean } {
  // If base is empty, combine unique blocks from local and remote
  if (baseBlocks.length === 0) {
    const merged = [...localBlocks]
    const localStrings = new Set(localBlocks.map(serializeNode))
    for (const r of remoteBlocks) {
      if (!localStrings.has(serializeNode(r))) {
        merged.push(r)
      }
    }
    return { blocks: merged.length ? merged : [{ type: 'paragraph' }], hasConflict: false }
  }

  // When lengths are equal, 1:1 positional 3-way merge
  if (baseBlocks.length === localBlocks.length && baseBlocks.length === remoteBlocks.length) {
    const merged: JSONContent[] = []
    let hasConflict = false
    for (let i = 0; i < baseBlocks.length; i += 1) {
      const bStr = serializeNode(baseBlocks[i]!)
      const lStr = serializeNode(localBlocks[i]!)
      const rStr = serializeNode(remoteBlocks[i]!)

      if (lStr === rStr) {
        merged.push(localBlocks[i]!)
      } else if (lStr === bStr) {
        merged.push(remoteBlocks[i]!)
      } else if (rStr === bStr) {
        merged.push(localBlocks[i]!)
      } else {
        // Both changed the same block differently: keep local, append remote
        merged.push(localBlocks[i]!)
        merged.push(remoteBlocks[i]!)
        hasConflict = true
      }
    }
    return { blocks: merged, hasConflict }
  }

  // For differing lengths (e.g., additions/removals)
  const baseSerial = baseBlocks.map(serializeNode)
  const localSerial = localBlocks.map(serializeNode)
  const remoteSerial = remoteBlocks.map(serializeNode)

  const merged: JSONContent[] = []
  let hasConflict = false

  // Process common prefix up to base length
  const minCommon = Math.min(baseBlocks.length, localBlocks.length, remoteBlocks.length)
  for (let i = 0; i < minCommon; i += 1) {
    const bStr = baseSerial[i]!
    const lStr = localSerial[i]!
    const rStr = remoteSerial[i]!

    if (lStr === rStr) {
      merged.push(localBlocks[i]!)
    } else if (lStr === bStr) {
      merged.push(remoteBlocks[i]!)
    } else if (rStr === bStr) {
      merged.push(localBlocks[i]!)
    } else {
      merged.push(localBlocks[i]!)
      merged.push(remoteBlocks[i]!)
      hasConflict = true
    }
  }

  // Include any extra local blocks
  if (localBlocks.length > minCommon) {
    for (let i = minCommon; i < localBlocks.length; i += 1) {
      merged.push(localBlocks[i]!)
    }
  }

  // Include any extra remote blocks (that are not already present in local)
  if (remoteBlocks.length > minCommon) {
    const localSet = new Set(localSerial)
    for (let i = minCommon; i < remoteBlocks.length; i += 1) {
      const rStr = remoteSerial[i]!
      if (!localSet.has(rStr)) {
        merged.push(remoteBlocks[i]!)
      }
    }
  }

  if (merged.length === 0) {
    merged.push({ type: 'paragraph' })
  }

  return { blocks: merged, hasConflict }
}

function mergeLines(baseRaw: string, localRaw: string, remoteRaw: string): DocumentMergeResult {
  const baseLines = baseRaw.split('\n')
  const localLines = localRaw.split('\n')
  const remoteLines = remoteRaw.split('\n')

  const merged: string[] = []
  let hasConflict = false

  const maxLen = Math.max(localLines.length, remoteLines.length)
  for (let i = 0; i < maxLen; i += 1) {
    const l = localLines[i]
    const r = remoteLines[i]
    const b = baseLines[i]

    if (l !== undefined && r !== undefined) {
      if (l === r) {
        merged.push(l)
      } else if (l === b) {
        merged.push(r)
      } else if (r === b) {
        merged.push(l)
      } else {
        // Both changed: keep local, add remote if non-empty
        merged.push(l)
        if (r.trim()) merged.push(r)
        hasConflict = true
      }
    } else if (l !== undefined) {
      merged.push(l)
    } else if (r !== undefined) {
      merged.push(r)
    }
  }

  return { success: true, content: merged.join('\n'), hasConflict }
}

export function mergeDocuments(
  baseRaw: string | null | undefined,
  localRaw: string,
  remoteRaw: string
): DocumentMergeResult {
  if (localRaw === remoteRaw) {
    return { success: true, content: localRaw, hasConflict: false }
  }

  if (baseRaw && localRaw === baseRaw) {
    return { success: true, content: remoteRaw, hasConflict: false }
  }

  if (baseRaw && remoteRaw === baseRaw) {
    return { success: true, content: localRaw, hasConflict: false }
  }

  const parseJsonDoc = (raw: string): JSONContent | null => {
    try {
      const parsed = JSON.parse(raw) as JSONContent
      if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
        return parsed
      }
    } catch {
      // not JSON
    }
    return null
  }

  const localDoc = parseJsonDoc(localRaw)
  const remoteDoc = parseJsonDoc(remoteRaw)

  if (localDoc && remoteDoc) {
    const baseDoc = baseRaw ? parseJsonDoc(baseRaw) : null
    const { blocks, hasConflict } = mergeTiptapBlocks(
      baseDoc?.content ?? [],
      localDoc.content ?? [],
      remoteDoc.content ?? []
    )
    const resultDoc: JSONContent = {
      type: 'doc',
      ...localDoc.attrs ? { attrs: localDoc.attrs } : {},
      content: blocks,
    }
    return { success: true, content: JSON.stringify(resultDoc), hasConflict }
  }

  return mergeLines(baseRaw ?? '', localRaw, remoteRaw)
}
