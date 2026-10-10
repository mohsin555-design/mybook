import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface SearchHighlightMeta {
  query: string
  activeIndex: number
}

export interface SearchHighlightPluginState {
  query: string
  activeIndex: number
  decorations: DecorationSet
}

export const searchHighlightPluginKey = new PluginKey<SearchHighlightPluginState>('searchHighlight')

export function findMatchesInDoc(doc: ProseMirrorNode, query: string): Array<{ from: number; to: number }> {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return []
  const matches: Array<{ from: number; to: number }> = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const haystack = node.text.toLocaleLowerCase()
    let offset = 0
    while (offset <= haystack.length - needle.length) {
      const index = haystack.indexOf(needle, offset)
      if (index < 0) break
      matches.push({ from: pos + index, to: pos + index + needle.length })
      offset = index + needle.length
    }
  })
  return matches
}

export function createSearchDecorations(doc: ProseMirrorNode, query: string, activeIndex: number): DecorationSet {
  const matches = findMatchesInDoc(doc, query)
  if (!matches.length) return DecorationSet.empty

  const decorations = matches.map((match, i) => {
    const isActive = i === activeIndex
    return Decoration.inline(match.from, match.to, {
      class: isActive
        ? 'mybook-search-match mybook-search-match-active'
        : 'mybook-search-match',
      'data-match-index': String(i),
    })
  })

  return DecorationSet.create(doc, decorations)
}

export function createSearchHighlightPlugin(): Plugin<SearchHighlightPluginState> {
  return new Plugin<SearchHighlightPluginState>({
    key: searchHighlightPluginKey,
    state: {
      init(): SearchHighlightPluginState {
        return {
          query: '',
          activeIndex: 0,
          decorations: DecorationSet.empty,
        }
      },
      apply(tr, prevState, _, newState): SearchHighlightPluginState {
        const meta = tr.getMeta(searchHighlightPluginKey) as SearchHighlightMeta | undefined
        if (meta !== undefined) {
          const query = meta.query ?? ''
          const activeIndex = meta.activeIndex ?? 0
          return {
            query,
            activeIndex,
            decorations: createSearchDecorations(newState.doc, query, activeIndex),
          }
        }

        if (tr.docChanged && prevState.query) {
          return {
            query: prevState.query,
            activeIndex: prevState.activeIndex,
            decorations: createSearchDecorations(newState.doc, prevState.query, prevState.activeIndex),
          }
        }

        return prevState
      },
    },
    props: {
      decorations(state) {
        return searchHighlightPluginKey.getState(state)?.decorations ?? DecorationSet.empty
      },
    },
  })
}

export const SearchHighlight = Extension.create({
  name: 'searchHighlight',
  addProseMirrorPlugins() {
    return [createSearchHighlightPlugin()]
  },
})
