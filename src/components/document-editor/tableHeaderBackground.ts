import type { Editor } from '@tiptap/react'

export function resetHeaderCellBackgrounds(editor: Editor, cellPositions: number[]) {
  const transaction = editor.state.tr
  cellPositions.forEach((position) => {
    const cell = editor.state.doc.nodeAt(position)
    if (cell) transaction.setNodeMarkup(position, undefined, { ...cell.attrs, backgroundColor: null })
  })
  editor.view.dispatch(transaction)
}