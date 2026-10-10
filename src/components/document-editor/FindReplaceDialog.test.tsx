// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

  it('decorates search matches in page and supports keyboard navigation', () => {
    const editorElement = document.body.appendChild(document.createElement('div'))
    editor = new Editor({ element: editorElement, extensions: [StarterKit], content: '<p>apple banana apple cherry apple</p>' })
    const anchor = document.body.appendChild(document.createElement('button'))
    const anchorRef = { current: anchor }
    const onOpenChange = vi.fn()

    render(<FindReplaceDialog editor={editor} open onOpenChange={onOpenChange} anchorRef={anchorRef} />)

    const findInput = screen.getByLabelText('Find')
    fireEvent.change(findInput, { target: { value: 'apple' } })

    // Check matches count
    expect(screen.getByText('1 of 3 matches')).toBeInTheDocument()

    // Check in-page decorations
    const allMatches = editorElement.querySelectorAll('.mybook-search-match')
    expect(allMatches.length).toBe(3)
    const activeMatch = editorElement.querySelector('.mybook-search-match-active')
    expect(activeMatch).toBeInTheDocument()
    expect(activeMatch?.getAttribute('data-match-index')).toBe('0')

    // Navigate next via Enter
    fireEvent.keyDown(findInput, { key: 'Enter' })
    expect(screen.getByText('2 of 3 matches')).toBeInTheDocument()
    expect(editorElement.querySelector('.mybook-search-match-active')?.getAttribute('data-match-index')).toBe('1')

    // Navigate previous via Shift+Enter
    fireEvent.keyDown(findInput, { key: 'Enter', shiftKey: true })
    expect(screen.getByText('1 of 3 matches')).toBeInTheDocument()
    expect(editorElement.querySelector('.mybook-search-match-active')?.getAttribute('data-match-index')).toBe('0')

    // Close via Escape
    fireEvent.keyDown(findInput, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
