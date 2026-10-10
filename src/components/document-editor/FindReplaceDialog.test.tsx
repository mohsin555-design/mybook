// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FindReplaceDialog } from './FindReplaceDialog'

let editor: Editor | undefined

afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = undefined
})

describe('FindReplaceDialog', () => {
  it('opens as an anchored popover without a dialog overlay and keeps replace-all behavior', () => {
    const editorElement = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element: editorElement, extensions: [StarterKit], content: '<p>cat cat</p>' })
    const anchor = document.body.appendChild(document.createElement('button'))
    const anchorRef = { current: anchor }

    render(<FindReplaceDialog editor={editor} open onOpenChange={() => undefined} anchorRef={anchorRef} />)

    expect(screen.getByRole('heading', { name: 'Find and replace' })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="popover-content"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="dialog-backdrop"]')).toBeNull()

    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'cat' } })
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'dog' } })
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }))

    expect(editor.getText()).toBe('dog dog')
  })
})
