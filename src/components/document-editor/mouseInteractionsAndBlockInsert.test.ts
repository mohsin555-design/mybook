// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'

import { runSlashCommand } from './slashCommands'
import { Callout } from './extensions/Callout'
import { ToggleBlock } from './extensions/ToggleBlock'
import { TableOfContents } from './extensions/TableOfContents'

describe('Block conversions and insertion via + and slash menu', () => {
  const createTestEditor = (content: string) => {
    const element = document.body.appendChild(document.createElement('div'))
    const editor = new Editor({
      element,
      extensions: [
        StarterKit,
        TableKit,
        TaskList,
        TaskItem.configure({ nested: true }),
        Callout,
        ToggleBlock,
        TableOfContents,
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

  it('converts paragraph with text to heading 1 while preserving the text', () => {
    const { editor, cleanup } = createTestEditor('<p>Hello World</p>')
    editor.commands.setTextSelection(2)

    runSlashCommand(editor, 'h1', { from: 1, to: 1 }, true)

    expect(editor.isActive('heading', { level: 1 })).toBe(true)
    expect(editor.getText().trim()).toBe('Hello World')
    cleanup()
  })

  it('converts heading with text to bullet list while preserving the text', () => {
    const { editor, cleanup } = createTestEditor('<h2>List item heading</h2>')
    editor.commands.setTextSelection(3)

    runSlashCommand(editor, 'bullet', { from: 1, to: 1 }, true)

    expect(editor.isActive('bulletList')).toBe(true)
    expect(editor.getText().trim()).toBe('List item heading')
    cleanup()
  })

  it('converts paragraph with text to blockquote while preserving the text', () => {
    const { editor, cleanup } = createTestEditor('<p>Quoted text paragraph</p>')
    editor.commands.setTextSelection(4)

    runSlashCommand(editor, 'quote', { from: 1, to: 1 }, true)

    expect(editor.isActive('blockquote')).toBe(true)
    expect(editor.getText().trim()).toBe('Quoted text paragraph')
    cleanup()
  })

  it('converts paragraph with text to code block while preserving the text', () => {
    const { editor, cleanup } = createTestEditor('<p>const a = 10;</p>')
    editor.commands.setTextSelection(3)

    runSlashCommand(editor, 'code-block', { from: 1, to: 1 }, true)

    expect(editor.isActive('codeBlock')).toBe(true)
    expect(editor.getText().trim()).toBe('const a = 10;')
    cleanup()
  })

  it('converts paragraph with text to to-do task list while preserving the text', () => {
    const { editor, cleanup } = createTestEditor('<p>Finish project report</p>')
    editor.commands.setTextSelection(3)

    runSlashCommand(editor, 'task', { from: 1, to: 1 }, true)

    expect(editor.isActive('taskList')).toBe(true)
    expect(editor.getText().trim()).toBe('Finish project report')
    cleanup()
  })

  it('replaces an empty paragraph with a table without stray extra blocks', () => {
    const { editor, cleanup } = createTestEditor('<p></p>')
    editor.commands.setTextSelection(1)

    // Delete empty paragraph and insert table
    editor.chain().focus().deleteRange({ from: 0, to: 2 }).run()
    runSlashCommand(editor, 'table', { from: 0, to: 0 })

    expect(editor.isActive('table')).toBe(true)
    expect(editor.state.doc.firstChild?.type.name).toBe('table')
    cleanup()
  })

  it('replaces an empty paragraph with a callout without stray extra blocks', () => {
    const { editor, cleanup } = createTestEditor('<p></p>')
    editor.commands.setTextSelection(1)

    editor.chain().focus().deleteRange({ from: 0, to: 2 }).run()
    runSlashCommand(editor, 'callout', { from: 0, to: 0 })

    expect(editor.state.doc.firstChild?.type.name).toBe('callout')
    cleanup()
  })

  it('still deletes slash query when executed as a typed slash command', () => {
    const { editor, cleanup } = createTestEditor('<p>/h2</p>')
    editor.commands.setTextSelection(4)

    runSlashCommand(editor, 'h2', { from: 1, to: 4 }, false)

    expect(editor.isActive('heading', { level: 2 })).toBe(true)
    expect(editor.getText().trim()).toBe('')
    cleanup()
  })
})
