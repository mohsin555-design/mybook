import { describe, expect, it } from 'vitest'

import {
  getTableOfContentsEntries,
  plainTextFromJsonContent,
  tableOfContentsNode,
} from './tableOfContentsModel'

function headingNode(level: number, textContent: string) {
  return {
    type: { name: 'heading' },
    attrs: { level },
    textContent,
  }
}

function paragraphNode(textContent: string) {
  return {
    type: { name: 'paragraph' },
    attrs: {},
    textContent,
  }
}

function toggleBlockNode(level: number | null, title: string) {
  return {
    type: { name: 'toggleBlock' },
    attrs: { level, title },
    textContent: '',
  }
}

function docWithNodes(nodes: Array<ReturnType<typeof headingNode> | ReturnType<typeof paragraphNode>>) {
  return {
    descendants(callback: (node: ReturnType<typeof headingNode> | ReturnType<typeof paragraphNode>, pos: number) => boolean | void) {
      nodes.forEach((node, index) => callback(node, index * 10))
    },
  }
}

describe('table of contents block', () => {
  it('creates the persisted TOC node without heading snapshots', () => {
    expect(tableOfContentsNode()).toEqual({ type: 'tableOfContents' })
  })

  it('extracts supported heading levels and skips empty headings', () => {
    const entries = getTableOfContentsEntries(docWithNodes([
      headingNode(1, 'Introduction'),
      paragraphNode('Body'),
      headingNode(2, 'Product goals'),
      headingNode(3, 'Requirements'),
      headingNode(4, 'Details'),
      headingNode(2, '   '),
    ]) as never)

    expect(entries).toEqual([
      { id: 'toc-0-0', level: 1, pos: 0, text: 'Introduction' },
      { id: 'toc-20-1', level: 2, pos: 20, text: 'Product goals' },
      { id: 'toc-30-2', level: 3, pos: 30, text: 'Requirements' },
      { id: 'toc-40-3', level: 4, pos: 40, text: 'Details' },
    ])
  })

  it('extracts toggle headings with levels 1 to 4 and skips normal or empty-title toggles', () => {
    const entries = getTableOfContentsEntries(docWithNodes([
      toggleBlockNode(1, 'Toggle Heading 1'),
      toggleBlockNode(null, 'Normal Toggle without Level'),
      toggleBlockNode(2, '   '),
      headingNode(2, 'Standard Heading 2'),
      toggleBlockNode(3, 'Toggle Heading 3'),
      toggleBlockNode(4, 'Toggle Heading 4'),
    ]) as never)

    expect(entries).toEqual([
      { id: 'toc-0-0', level: 1, pos: 0, text: 'Toggle Heading 1' },
      { id: 'toc-30-1', level: 2, pos: 30, text: 'Standard Heading 2' },
      { id: 'toc-40-2', level: 3, pos: 40, text: 'Toggle Heading 3' },
      { id: 'toc-50-3', level: 4, pos: 50, text: 'Toggle Heading 4' },
    ])
  })

  it('keeps duplicate heading titles distinct by position', () => {
    const entries = getTableOfContentsEntries(docWithNodes([
      headingNode(1, 'Overview'),
      headingNode(2, 'Overview'),
    ]) as never)

    expect(entries.map((entry) => entry.text)).toEqual(['Overview', 'Overview'])
    expect(entries.map((entry) => entry.pos)).toEqual([0, 10])
    expect(entries[0]?.id).not.toBe(entries[1]?.id)
  })

  it('derives plain text from rich heading JSON content', () => {
    expect(plainTextFromJsonContent([
      { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' + ' },
      { type: 'text', text: 'code', marks: [{ type: 'code' }] },
      { type: 'hardBreak' },
      { type: 'text', text: 'नमस्ते مرحبا 😀' },
    ])).toBe('Bold + code नमस्ते مرحبا 😀')
  })
})
