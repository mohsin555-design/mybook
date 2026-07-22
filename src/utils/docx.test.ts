import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { createDocxBlob } from './docx'

const richDocument: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Overview' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Formatted', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] }] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }] }] }] },
  ],
}

describe('DOCX conversion', () => {
  it('creates a valid OOXML zip blob from rich Tiptap JSON', async () => {
    const blob = await createDocxBlob('Test document', richDocument)
    const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(blob.size).toBeGreaterThan(1000)
    expect([...signature]).toEqual([0x50, 0x4b])
  })

  it('degrades unknown nodes without throwing', async () => {
    const blob = await createDocxBlob('Fallback', { type: 'doc', content: [{ type: 'unsupported', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Kept' }] }] }] })
    expect(blob.size).toBeGreaterThan(1000)
  })
})
