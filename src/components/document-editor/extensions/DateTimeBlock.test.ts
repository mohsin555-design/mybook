// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { DateTimeBlock, dateTimeBlockNode, handleDateTimeBlockAdjacentDelete } from './DateTimeBlock'

function createEditor() {
  return new Editor({
    extensions: [StarterKit, DateTimeBlock],
    content: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'dateTimeBlock', attrs: { value: '2026-10-03T12:00:00.000Z' } },
        ],
      }],
    },
  })
}

describe('DateTimeBlock keyboard deletion', () => {
  it('selects the mention at the Backspace boundary and removes it on the next press', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(2)
    expect(handleDateTimeBlockAdjacentDelete(editor.view, 'Backspace')).toBe(true)
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('dateTimeBlock')

    expect(handleDateTimeBlockAdjacentDelete(editor.view, 'Backspace')).toBe(true)
    expect(editor.getJSON().content?.[0]?.content).toBeUndefined()
    editor.destroy()
  })

  it('selects the mention at the Delete boundary before removing it', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(1)

    expect(handleDateTimeBlockAdjacentDelete(editor.view, 'Delete')).toBe(true)
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect(handleDateTimeBlockAdjacentDelete(editor.view, 'Delete')).toBe(true)
    expect(editor.getJSON().content?.[0]?.content).toBeUndefined()
    editor.destroy()
  })

  it('selects a mention from the start of the following line instead of dropping the caret there', () => {
    const editor = new Editor({
      extensions: [StarterKit, DateTimeBlock],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'dateTimeBlock', attrs: { value: '2026-10-03T12:00:00.000Z' } },
            ],
          },
          { type: 'paragraph' },
        ],
      },
    })
    editor.commands.setTextSelection(4) // Start of the next paragraph.

    expect(handleDateTimeBlockAdjacentDelete(editor.view, 'Backspace')).toBe(true)
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('dateTimeBlock')
    expect(handleDateTimeBlockAdjacentDelete(editor.view, 'Backspace')).toBe(true)
    expect(editor.getJSON().content?.[0]?.content).toBeUndefined()
    editor.destroy()
  })

  it('keeps the caret after the mention while clearing adjacent text, then selects and deletes the mention', () => {
    const editor = new Editor({
      extensions: [StarterKit, DateTimeBlock],
      content: { type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph' }] },
    })
    editor.commands.setTextSelection(1)
    editor.chain().insertContent(dateTimeBlockNode()).run()
    editor.view.dispatch(editor.state.tr.insertText('ab'))
    expect(editor.getJSON().content?.[0]?.content?.map((n) => n.type === 'text' ? (n as { text?: string }).text : n.type)).toEqual(['dateTimeBlock', 'ab'])

    const backspace = () => {
      if (handleDateTimeBlockAdjacentDelete(editor.view, 'Backspace')) return
      const { from } = editor.state.selection
      editor.view.dispatch(editor.state.tr.delete(from - 1, from))
    }
    backspace()
    backspace()

    expect(editor.getJSON().content?.[0]?.content?.map((n) => n.type)).toEqual(['dateTimeBlock'])
    expect(editor.state.selection).toBeInstanceOf(TextSelection)
    expect(editor.state.selection.from).toBe(2)
    expect(editor.state.selection.$from.parent).toBe(editor.state.doc.child(0))

    expect(handleDateTimeBlockAdjacentDelete(editor.view, 'Backspace')).toBe(true)
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect(handleDateTimeBlockAdjacentDelete(editor.view, 'Backspace')).toBe(true)
    expect(editor.getJSON().content?.[0]?.content).toBeUndefined()
    expect(editor.state.selection.$from.parent).toBe(editor.state.doc.child(0))
    editor.destroy()
  })
})
