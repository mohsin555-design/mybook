// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import { FixedTable } from './FixedTable'
import { StyledTableCell, StyledTableHeader } from './TableCellStyles'

describe('FixedTable', () => {
  let editor: Editor

  afterEach(() => editor?.destroy())

  it('preserves a whole-table width while individual column widths change', () => {
    editor = new Editor({
      extensions: [StarterKit, TableKit.configure({ table: false, tableCell: false, tableHeader: false }), FixedTable.configure({ resizable: true, cellMinWidth: 96 }), StyledTableCell, StyledTableHeader],
      content: {
        type: 'doc',
        content: [{
          type: 'table',
          attrs: { tableWidth: 320 },
          content: [{
            type: 'tableRow',
            content: [
              { type: 'tableCell', attrs: { colwidth: [120] }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
              { type: 'tableCell', attrs: { colwidth: [200] }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Status' }] }] },
            ],
          }],
        }],
      },
    })

    const table = editor.view.dom.querySelector('table')
    const columns = editor.view.dom.querySelectorAll('col')

    expect(table?.style.width).toBe('320px')
    expect(columns[0]?.getAttribute('style')).toContain('width: 120px')
    expect(columns[1]?.getAttribute('style')).toContain('width: 200px')

    let firstCellPosition = 0
    editor.state.doc.descendants((node, position) => {
      if (!firstCellPosition && node.type.name === 'tableCell') firstCellPosition = position
    })
    const firstCell = editor.state.doc.nodeAt(firstCellPosition)
    editor.view.dispatch(editor.state.tr.setNodeMarkup(firstCellPosition, undefined, { ...firstCell?.attrs, colwidth: [140] }))

    expect(table?.style.width).toBe('320px')
    expect(columns[0]?.getAttribute('style')).toContain('width: 140px')
    expect(editor.state.doc.firstChild?.attrs.tableWidth).toBe(320)
  })

  it('does not clear or crash on edits before a resized table', () => {
    editor = new Editor({
      extensions: [StarterKit, TableKit.configure({ table: false, tableCell: false, tableHeader: false }), FixedTable.configure({ resizable: true, cellMinWidth: 96 }), StyledTableCell, StyledTableHeader],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
          { type: 'table', attrs: { tableWidth: 320 }, content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }] }] }] },
        ],
      },
    })

    editor.view.dispatch(editor.state.tr.insertText(' updated', 7))

    expect(editor.state.doc.child(1).attrs.tableWidth).toBe(320)
  })
})