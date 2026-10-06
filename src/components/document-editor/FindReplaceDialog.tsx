import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { useState } from 'react'

import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'

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

export function FindReplaceDialog({ editor, open, onOpenChange }: { editor: Editor; open: boolean; onOpenChange: (open: boolean) => void }) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Find and replace</DialogTitle>
          <DialogDescription>Search this document and replace matching text.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1.5 text-sm font-medium">Find<Input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} /></label>
          <label className="block space-y-1.5 text-sm font-medium">Replace with<Input value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label>
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{matches.length ? `${activeIndex + 1} of ${matches.length} matches` : 'No matches'}</span><div className="flex gap-1"><Button type="button" variant="outline" size="sm" disabled={!matches.length} onClick={() => findNext(-1)}>Previous</Button><Button type="button" variant="outline" size="sm" disabled={!matches.length} onClick={() => findNext(1)}>Next</Button></div></div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={!matches.length} onClick={replaceCurrent}>Replace</Button>
          <Button type="button" disabled={!matches.length} onClick={replaceAll}>Replace all</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
