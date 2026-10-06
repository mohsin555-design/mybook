import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { mergeDocuments } from './documentMerge'

const docWith = (texts: string[]) => JSON.stringify({
  type: 'doc',
  content: texts.map((text) => ({
    type: 'paragraph',
    content: [{ type: 'text', text }],
  })),
})

describe('mergeDocuments', () => {
  it('returns local content when local and remote are identical', () => {
    const doc = docWith(['Hello world'])
    const result = mergeDocuments(doc, doc, doc)
    expect(result.content).toBe(doc)
    expect(result.hasConflict).toBe(false)
  })

  it('returns remote when local did not change since base', () => {
    const base = docWith(['Hello'])
    const remote = docWith(['Hello', 'World'])
    const result = mergeDocuments(base, base, remote)
    expect(result.content).toBe(remote)
    expect(result.hasConflict).toBe(false)
  })

  it('returns local when remote did not change since base', () => {
    const base = docWith(['Hello'])
    const local = docWith(['Hello', 'My local addition'])
    const result = mergeDocuments(base, local, base)
    expect(result.content).toBe(local)
    expect(result.hasConflict).toBe(false)
  })

  it('merges non-overlapping block edits cleanly', () => {
    const base = docWith(['Block 1', 'Block 2', 'Block 3'])
    // Local edits block 1
    const local = docWith(['Block 1 - edited locally', 'Block 2', 'Block 3'])
    // Remote edits block 3 and adds block 4
    const remote = docWith(['Block 1', 'Block 2', 'Block 3 - edited remotely', 'Block 4 - added remotely'])

    const result = mergeDocuments(base, local, remote)
    const parsed = JSON.parse(result.content) as JSONContent
    const texts = (parsed.content ?? []).map((p) => p.content?.[0]?.text)

    expect(texts).toContain('Block 1 - edited locally')
    expect(texts).toContain('Block 2')
    expect(texts).toContain('Block 3 - edited remotely')
    expect(texts).toContain('Block 4 - added remotely')
  })

  it('merges plain text lines correctly', () => {
    const base = 'Line 1\nLine 2\nLine 3'
    const local = 'Line 1 edited\nLine 2\nLine 3'
    const remote = 'Line 1\nLine 2\nLine 3 edited'

    const result = mergeDocuments(base, local, remote)
    expect(result.content).toBe('Line 1 edited\nLine 2\nLine 3 edited')
  })
})
