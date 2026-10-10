import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { useState, type RefObject } from 'react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent } from '../ui/popover'

function findMatches(editor: Editor, query: string) {
  const needle = query.toLocaleLowerCase()
  if (!needle) return []
  const matches: Array<{ from: number; to: number }> = []
  editor.state.doc.descendants((node, pos) => {
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

export function FindReplaceDialog({ editor, open, onOpenChange, anchorRef }: { editor: Editor; open: boolean; onOpenChange: (open: boolean) => void; anchorRef: RefObject<HTMLElement | null> }) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const matches = findMatches(editor, query)

  const selectMatch = (index: number) => {
    if (!matches.length) return
    const normalized = ((index % matches.length) + matches.length) % matches.length
    const match = matches[normalized]!
    setActiveIndex(normalized)
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, match.from, match.to)).scrollIntoView())
    editor.view.focus()
  }

  const findNext = (direction: 1 | -1) => {
    if (!matches.length) return
    const current = editor.state.selection.from
    const nextIndex = direction > 0
      ? matches.findIndex((match) => match.from > current)
      : matches.map((match) => match.from < current).lastIndexOf(true)
    selectMatch(nextIndex < 0 ? (direction > 0 ? 0 : matches.length - 1) : nextIndex)
  }

  const replaceCurrent = () => {
    const selected = editor.state.selection
    if (selected.empty || !editor.state.doc.textBetween(selected.from, selected.to).toLocaleLowerCase().includes(query.toLocaleLowerCase())) {
      findNext(1)
      return
    }
    editor.view.dispatch(editor.state.tr.insertText(replacement, selected.from, selected.to).scrollIntoView())
    findNext(1)
  }

  const replaceAll = () => {
    if (!matches.length) return
    const transaction = editor.state.tr
    for (const match of [...matches].reverse()) transaction.insertText(replacement, match.from, match.to)
    editor.view.dispatch(transaction)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverContent anchor={anchorRef} side="left" align="start" className="w-[min(360px,calc(100vw-1rem))] gap-3 rounded-xl p-3 shadow-lg" aria-label="Find and replace">
        <h2 className="text-sm font-semibold">Find and replace</h2>
        <div className="space-y-3">
          <label className="block space-y-1.5 text-sm font-medium">Find<Input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} /></label>
          <label className="block space-y-1.5 text-sm font-medium">Replace with<Input value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label>
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{matches.length ? `${activeIndex + 1} of ${matches.length} matches` : 'No matches'}</span><div className="flex gap-1"><Button type="button" variant="outline" size="sm" disabled={!matches.length} onClick={() => findNext(-1)}>Previous</Button><Button type="button" variant="outline" size="sm" disabled={!matches.length} onClick={() => findNext(1)}>Next</Button></div></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" disabled={!matches.length} onClick={replaceCurrent}>Replace</Button><Button type="button" size="sm" disabled={!matches.length} onClick={replaceAll}>Replace all</Button></div>
      </PopoverContent>
    </Popover>
  )
}
