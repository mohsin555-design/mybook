import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { useCallback, useEffect, useState } from 'react'

import { getTableOfContentsEntries, type TableOfContentsEntry } from './tableOfContentsModel'

export function TableOfContentsNodeView({ editor, selected }: NodeViewProps) {
  const [entries, setEntries] = useState<TableOfContentsEntry[]>(() => getTableOfContentsEntries(editor.state.doc))

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

  return (
    <NodeViewWrapper
      as="nav"
      data-drag-handle
      aria-label="Table of contents"
      className={`mybook-table-of-contents my-5 rounded-[8px] border bg-[var(--app-surface)] px-4 py-3 text-sm ${selected ? 'border-[var(--accent)] ring-2 ring-[var(--focus-ring)]' : 'border-[var(--app-border)]'}`}
      contentEditable={false}
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Table of contents</div>
      {entries.length ? (
        <ol className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => goToHeading(entry.pos)}
                className="block min-h-8 w-full rounded-[6px] px-2 py-1 text-left leading-snug text-foreground transition hover:bg-[var(--app-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                style={{ paddingLeft: `${(entry.level - 1) * 1.25 + 0.5}rem` }}
              >
                <span className="break-words">{entry.text}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-[6px] px-2 py-1 text-sm text-muted-foreground">Add headings to create a table of contents.</p>
      )}
    </NodeViewWrapper>
  )
}
