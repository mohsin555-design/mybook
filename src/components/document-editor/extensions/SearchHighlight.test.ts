// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'

import {
  findMatchesInDoc,
  SearchHighlight,
  searchHighlightPluginKey,
} from './SearchHighlight'

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

describe('SearchHighlight', () => {
  it('finds matches in document text case-insensitively', () => {
    editor = new Editor({
      extensions: [StarterKit, SearchHighlight],
      content: '<p>Hello World hello</p>',
    })

    const matches = findMatchesInDoc(editor.state.doc, 'hello')
    expect(matches.length).toBe(2)
  })

  it('updates in-page search decorations when dispatched', () => {
    const el = document.body.appendChild(document.createElement('div'))
    editor = new Editor({
      element: el,
      extensions: [StarterKit, SearchHighlight],
      content: '<p>The quick brown fox jumps over the lazy dog</p>',
    })

    editor.view.dispatch(
      editor.state.tr.setMeta(searchHighlightPluginKey, { query: 'the', activeIndex: 1 })
    )

    const matches = el.querySelectorAll('.mybook-search-match')
    expect(matches.length).toBe(2)

    const activeMatch = el.querySelector('.mybook-search-match-active')
    expect(activeMatch).toBeInTheDocument()
    expect(activeMatch?.getAttribute('data-match-index')).toBe('1')

    // Clearing query removes all decorations
    editor.view.dispatch(
      editor.state.tr.setMeta(searchHighlightPluginKey, { query: '', activeIndex: 0 })
    )
    expect(el.querySelectorAll('.mybook-search-match').length).toBe(0)
  })
})
