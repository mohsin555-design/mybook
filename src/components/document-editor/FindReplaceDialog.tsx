import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent } from '../ui/popover'
import {
  createSearchHighlightPlugin,
  findMatchesInDoc,
  searchHighlightPluginKey,
} from './extensions/SearchHighlight'

export function FindReplaceDialog({
  editor,
  open,
  onOpenChange,
  anchorRef,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: RefObject<HTMLElement | null>
}) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  // Register plugin if not already in editor plugins (e.g. standalone test environment)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const isRegistered = searchHighlightPluginKey.get(editor.state) !== undefined
    if (!isRegistered) {
      editor.registerPlugin(createSearchHighlightPlugin())
      return () => {
        editor.unregisterPlugin(searchHighlightPluginKey)
      }
    }
  }, [editor])

  const matches = useMemo(() => {
    if (!editor || editor.isDestroyed || !open) return []
    return findMatchesInDoc(editor.state.doc, query)
  }, [editor, query, open])

  // Update in-page highlight decorations whenever query, activeIndex, or open status changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (!open || !query.trim()) {
      editor.view.dispatch(editor.state.tr.setMeta(searchHighlightPluginKey, { query: '', activeIndex: 0 }))
      return
    }
    editor.view.dispatch(editor.state.tr.setMeta(searchHighlightPluginKey, { query, activeIndex }))
  }, [editor, open, query, activeIndex])

  // Clear highlight decorations when component unmounts
  useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed) {
        editor.view.dispatch(editor.state.tr.setMeta(searchHighlightPluginKey, { query: '', activeIndex: 0 }))
      }
    }
  }, [editor])

  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const selectMatch = (index: number) => {
    if (!matches.length || !editor || editor.isDestroyed) return
    const normalized = ((index % matches.length) + matches.length) % matches.length
    const match = matches[normalized]!
    setActiveIndex(normalized)
    editor.view.dispatch(
      editor.state.tr
        .setSelection(TextSelection.create(editor.state.doc, match.from, match.to))
        .setMeta(searchHighlightPluginKey, { query, activeIndex: normalized })
        .scrollIntoView()
    )
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = window.requestAnimationFrame(() => {
      if (!editor || editor.isDestroyed) return
      try {
        const dom = editor.view?.dom
        const activeEl = dom?.querySelector?.('.mybook-search-match-active')
        if (activeEl && typeof activeEl.scrollIntoView === 'function') {
          activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
        }
      } catch {
        // editor view might be unmounted
      }
    })
  }

  const findNext = (direction: 1 | -1) => {
    if (!matches.length || !editor || editor.isDestroyed) return
    const current = editor.state.selection.from
    const nextIndex = direction > 0
      ? matches.findIndex((match) => match.from > current)
      : matches.map((match) => match.from < current).lastIndexOf(true)
    selectMatch(nextIndex < 0 ? (direction > 0 ? 0 : matches.length - 1) : nextIndex)
  }

  const replaceCurrent = () => {
    if (!editor || editor.isDestroyed) return
    const selected = editor.state.selection
    if (selected.empty || !editor.state.doc.textBetween(selected.from, selected.to).toLocaleLowerCase().includes(query.toLocaleLowerCase())) {
      findNext(1)
      return
    }
    editor.view.dispatch(editor.state.tr.insertText(replacement, selected.from, selected.to).scrollIntoView())
    findNext(1)
  }

  const replaceAll = () => {
    if (!matches.length || !editor || editor.isDestroyed) return
    const transaction = editor.state.tr
    for (const match of [...matches].reverse()) transaction.insertText(replacement, match.from, match.to)
    editor.view.dispatch(transaction)
    setActiveIndex(0)
  }

  const handleFindKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) {
        findNext(-1)
      } else {
        findNext(1)
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
    }
  }

  const handleReplaceKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      replaceCurrent()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent anchor={anchorRef} side="left" align="start" className="w-[min(360px,calc(100vw-1rem))] gap-3 rounded-xl p-3 shadow-lg" aria-label="Find and replace">
        <h2 className="text-sm font-semibold">Find and replace</h2>
        <div className="space-y-3">
          <label className="block space-y-1.5 text-sm font-medium">
            Find
            <Input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleFindKeyDown}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Replace with
            <Input
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              onKeyDown={handleReplaceKeyDown}
            />
          </label>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span aria-live="polite">{matches.length ? `${activeIndex + 1} of ${matches.length} matches` : 'No matches'}</span>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" disabled={!matches.length} onClick={() => findNext(-1)}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={!matches.length} onClick={() => findNext(1)}>Next</Button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!matches.length} onClick={replaceCurrent}>Replace</Button>
          <Button type="button" size="sm" disabled={!matches.length} onClick={replaceAll}>Replace all</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
