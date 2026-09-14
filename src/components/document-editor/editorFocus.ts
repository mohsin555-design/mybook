import type { Editor } from '@tiptap/react'
import { AllSelection, TextSelection } from '@tiptap/pm/state'

export function keepEditorFocusedOnBlankClick(editor: Editor, event: Pick<MouseEvent, 'preventDefault'>) {
  event.preventDefault()
  editor.view.focus()
}

export function isEditorInteractiveTarget(target: Element) {
  return Boolean(target.closest('textarea, input, button, a, .column-resize-handle'))
}

export function isBlankEditorPoint(editor: Pick<Editor, 'view'>, target: Element) {
  if (target === editor.view.dom) return true
  const blockElement = target.closest('p, h1, h2, h3, h4, li, blockquote, pre, .mybook-callout, .mybook-toggle, .mybook-file-attachment, .mybook-image-block')
  return !blockElement
}

export function isSelectionInsideTable(editor: Pick<Editor, 'state'>) {
  for (let depth = editor.state.selection.$from.depth; depth > 0; depth -= 1) {
    if (editor.state.selection.$from.node(depth).type.name === 'table') return true
  }
  return false
}

export function clearTableSelection(editor: Editor) {
  if (!isSelectionInsideTable(editor)) return false

  let outsideTablePosition: number | null = null
  editor.state.doc.descendants((node, position, parent) => {
    if (outsideTablePosition !== null || !node.isTextblock) return
    if (parent?.type.name !== 'tableCell' && parent?.type.name !== 'tableHeader') outsideTablePosition = position + 1
  })

  const transaction = outsideTablePosition === null
    ? editor.state.tr.setSelection(new AllSelection(editor.state.doc))
    : editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(outsideTablePosition)))
  editor.view.dispatch(transaction)
  return true
}