// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'

import { EditorKeyboardShortcuts } from './extensions/EditorKeyboardShortcuts'
import { Callout } from './extensions/Callout'
import { ToggleBlock } from './extensions/ToggleBlock'
import { FixedTable } from './extensions/FixedTable'
import { StyledTableCell, StyledTableHeader } from './extensions/TableCellStyles'
import { TableInteraction } from './extensions/TableInteraction'

describe('Editor Keyboard Accessibility & Shortcuts', () => {
  const createEditor = (content: string) => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
        FixedTable,
        StyledTableCell,
        StyledTableHeader,
        TableInteraction,
        Callout,
        ToggleBlock,
        EditorKeyboardShortcuts,
      ],
      content,
    })
    return {
      editor,
      cleanup: () => {
        editor.destroy()
        element.remove()
      },
    }
  }

  it('indents (nests) bullet list item with sinkListItem', () => {
    const { editor, cleanup } = createEditor('<ul><li><p>First</p></li><li><p>Second</p></li></ul>')
    // Position inside the second list item text
    editor.commands.setTextSelection(12)

    expect(editor.can().sinkListItem('listItem')).toBe(true)
    const result = editor.commands.sinkListItem('listItem')
    expect(result).toBe(true)

    // Check that the second item is now nested inside the first
    expect(editor.getHTML()).toContain('<ul><li><p>First</p><ul><li><p>Second</p></li></ul></li></ul>')
    cleanup()
  })

  it('outdents (lifts) nested bullet list item with liftListItem', () => {
    const { editor, cleanup } = createEditor('<ul><li><p>First</p><ul><li><p>Second</p></li></ul></li></ul>')
    // Position inside the nested second list item
    editor.commands.setTextSelection(14)

    expect(editor.can().liftListItem('listItem')).toBe(true)
    const result = editor.commands.liftListItem('listItem')
    expect(result).toBe(true)

    expect(editor.getHTML()).toContain('<ul><li><p>First</p></li><li><p>Second</p></li></ul>')
    cleanup()
  })

  it('indents (nests) task list item with sinkListItem', () => {
    const { editor, cleanup } = createEditor('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task 1</p></li><li data-type="taskItem" data-checked="false"><p>Task 2</p></li></ul>')
    editor.commands.setTextSelection(13)

    expect(editor.can().sinkListItem('taskItem')).toBe(true)
    const result = editor.commands.sinkListItem('taskItem')
    expect(result).toBe(true)

    expect(editor.getHTML()).toContain('Task 1')
    expect(editor.getHTML()).toContain('Task 2')
    cleanup()
  })

  it('outdents (lifts) nested task list item with liftListItem', () => {
    const { editor, cleanup } = createEditor('<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task 1</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Task 2</p></li></ul></li></ul>')
    editor.commands.setTextSelection(15)

    expect(editor.can().liftListItem('taskItem')).toBe(true)
    const result = editor.commands.liftListItem('taskItem')
    expect(result).toBe(true)
    cleanup()
  })

  it('navigates table cells with goToNextCell and goToPreviousCell', () => {
    const { editor, cleanup } = createEditor('<p>Before</p>')
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false })

    expect(editor.isActive('table')).toBe(true)
    expect(editor.commands.goToNextCell()).toBe(true)
    expect(editor.commands.goToPreviousCell()).toBe(true)
    cleanup()
  })

  it('toggles formatting marks via Mod shortcuts', () => {
    const { editor, cleanup } = createEditor('<p>Sample Text</p>')
    editor.commands.setTextSelection({ from: 1, to: 7 })

    editor.commands.toggleBold()
    expect(editor.isActive('bold')).toBe(true)

    editor.commands.toggleItalic()
    expect(editor.isActive('italic')).toBe(true)

    editor.commands.toggleUnderline()
    expect(editor.isActive('underline')).toBe(true)

    editor.commands.toggleStrike()
    expect(editor.isActive('strike')).toBe(true)

    editor.commands.toggleCode()
    expect(editor.isActive('code')).toBe(true)

    cleanup()
  })

  it('toggles heading levels 1-4 via heading commands', () => {
    const { editor, cleanup } = createEditor('<p>Heading Title</p>')
    editor.commands.setTextSelection(3)

    editor.commands.toggleHeading({ level: 1 })
    expect(editor.isActive('heading', { level: 1 })).toBe(true)

    editor.commands.toggleHeading({ level: 2 })
    expect(editor.isActive('heading', { level: 2 })).toBe(true)

    editor.commands.toggleHeading({ level: 3 })
    expect(editor.isActive('heading', { level: 3 })).toBe(true)

    editor.commands.toggleHeading({ level: 4 })
    expect(editor.isActive('heading', { level: 4 })).toBe(true)

    editor.commands.setParagraph()
    expect(editor.isActive('paragraph')).toBe(true)

    cleanup()
  })

  it('toggles blockquote and code block via shortcut commands', () => {
    const { editor, cleanup } = createEditor('<p>Block content</p>')
    editor.commands.setTextSelection(3)

    editor.commands.toggleBlockquote()
    expect(editor.isActive('blockquote')).toBe(true)

    editor.commands.setParagraph()
    editor.commands.toggleCodeBlock()
    expect(editor.isActive('codeBlock')).toBe(true)

    cleanup()
  })
})
