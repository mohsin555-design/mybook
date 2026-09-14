// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import StarterKit from '@tiptap/starter-kit'
import { NodeSelection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearTableSelection, isBlankEditorPoint, isEditorInteractiveTarget, keepEditorFocusedOnBlankClick } from './editorFocus'

describe('keepEditorFocusedOnBlankClick', () => {
  let editor: Editor

  afterEach(() => {
    editor?.destroy()
    document.body.replaceChildren()
  })

  it('preserves editor focus without changing its current selection', () => {
    const element = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element, extensions: [StarterKit], content: '<p>Active line</p>' })
    editor.commands.setTextSelection(4)
    const selectionBeforeClick = editor.state.selection.from
    const preventDefault = vi.fn()

    keepEditorFocusedOnBlankClick(editor, { preventDefault })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(editor.isFocused).toBe(true)
    expect(editor.state.selection.from).toBe(selectionBeforeClick)
  })

  it('clears a block node selection when blank editor space is clicked', () => {
    const element = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element, extensions: [StarterKit], content: '<p>Before</p><blockquote><p>Card</p></blockquote><p></p>' })
    editor.commands.setNodeSelection(8)
    const preventDefault = vi.fn()

    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    keepEditorFocusedOnBlankClick(editor, { preventDefault })

    expect(editor.state.selection).not.toBeInstanceOf(NodeSelection)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('allows an empty block to receive the caret', () => {
    const element = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element, extensions: [StarterKit], content: '<p></p>' })
    const emptyBlock = editor.view.dom.querySelector('p')

    expect(emptyBlock).not.toBeNull()
    expect(isBlankEditorPoint(editor, emptyBlock!)).toBe(false)
  })

  it('allows a click beside text in an existing block to move the caret', () => {
    const element = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element, extensions: [StarterKit], content: '<h2>Section title</h2>' })
    const heading = editor.view.dom.querySelector('h2')

    expect(heading).not.toBeNull()
    expect(isBlankEditorPoint(editor, heading!)).toBe(false)
  })

  it('leaves the native column-resize handle interactive', () => {
    const handle = document.body.appendChild(document.createElement('div'))
    handle.className = 'column-resize-handle'

    expect(isEditorInteractiveTarget(handle)).toBe(true)
  })

  it('moves a table selection to a non-table text block', () => {
    const element = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element, extensions: [StarterKit, TableKit], content: '<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table><p>Outside</p>' })
    editor.commands.setTextSelection(3)

    expect(clearTableSelection(editor)).toBe(true)
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    expect(editor.state.selection.$from.depth).toBe(1)
  })
})