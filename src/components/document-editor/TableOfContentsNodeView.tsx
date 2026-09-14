import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getTableOfContentsEntries, type TableOfContentsEntry } from './tableOfContentsModel'

export function TableOfContentsNodeView({ editor, getPos, selected }: NodeViewProps) {
  const [entries, setEntries] = useState<TableOfContentsEntry[]>(() => getTableOfContentsEntries(editor.state.doc))
  const [isExpanded, setIsExpanded] = useState(true)
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const update = () => setEntries(getTableOfContentsEntries(editor.state.doc))
    update()
    editor.on('transaction', update)
    return () => {
      editor.off('transaction', update)
    }
  }, [editor])

  const goToHeading = useCallback((pos: number) => {
    const { state, view } = editor
    const selection = TextSelection.near(state.doc.resolve(Math.min(pos + 1, state.doc.content.size)))
    view.dispatch(state.tr.setSelection(selection).scrollIntoView())
    view.focus()
  }, [editor])

  useEffect(() => {
    if (!selected) return
    const clearSelectionIfStillSelected = () => {
      if (typeof getPos !== 'function') return
      const pos = getPos()
      if (typeof pos !== 'number') return
      const { state, view } = editor
      if (!(state.selection instanceof NodeSelection) || state.selection.from !== pos) return
      const node = state.doc.nodeAt(pos)
      if (!node) return
      const nextPos = Math.min(pos + node.nodeSize, state.doc.content.size)
      view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(nextPos))))
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      window.requestAnimationFrame(clearSelectionIfStillSelected)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [editor, getPos, selected])

  return (
    <NodeViewWrapper
      as="nav"
      ref={rootRef}
      data-drag-handle
      aria-label="Table of contents"
      className={`mybook-table-of-contents my-5 rounded-[8px] border bg-[var(--app-surface)] px-4 py-3 text-left text-sm ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-[var(--app-border)]'}`}
      contentEditable={false}
    >
      <div className="mybook-table-of-contents-header">
        <button
          type="button"
          className="mybook-toggle-caret"
          aria-label={isExpanded ? 'Collapse table of contents' : 'Expand table of contents'}
          aria-expanded={isExpanded}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setIsExpanded((expanded) => !expanded)
          }}
        >
          {isExpanded ? '▾' : '▸'}
        </button>
        <div className="text-lg font-semibold text-foreground">Table of Contents</div>
      </div>
      {isExpanded ? (
        entries.length ? (
          <ol className="mybook-table-of-contents-list">
            {entries.map((entry) => (
              <li key={entry.id} className="text-left">
                <button
                  type="button"
                  onClick={() => goToHeading(entry.pos)}
                  className="mybook-table-of-contents-item block min-h-8 w-full rounded-[6px] px-2 py-1 text-left leading-snug text-foreground transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  style={{ paddingLeft: `${(entry.level - 1) * 1.25 + 0.5}rem` }}
                >
                  <span className="block break-words text-left">{entry.text}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-[6px] px-2 py-1 text-left text-sm text-muted-foreground">Add headings to create a table of contents.</p>
        )
      ) : null}
    </NodeViewWrapper>
  )
}
