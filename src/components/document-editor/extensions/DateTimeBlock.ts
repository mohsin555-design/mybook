import { mergeAttributes, Node } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { DateTimeBlockNodeView } from '../DateTimeBlockNodeView'

export const DateTimeBlock = Node.create({
  name: 'dateTimeBlock',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      value: { default: null, parseHTML: (element) => element.getAttribute('data-value'), renderHTML: (attributes) => attributes.value ? { 'data-value': attributes.value } : {} },
      includeTime: { default: true, parseHTML: (element) => element.getAttribute('data-include-time') !== 'false', renderHTML: (attributes) => ({ 'data-include-time': String(Boolean(attributes.includeTime)) }) },
      endDateEnabled: { default: false, parseHTML: (element) => element.getAttribute('data-end-date-enabled') === 'true', renderHTML: (attributes) => ({ 'data-end-date-enabled': String(Boolean(attributes.endDateEnabled)) }) },
      endValue: { default: null, parseHTML: (element) => element.getAttribute('data-end-value'), renderHTML: (attributes) => attributes.endValue ? { 'data-end-value': attributes.endValue } : {} },
      use24Hour: { default: false, parseHTML: (element) => element.getAttribute('data-use-24-hour') === 'true', renderHTML: (attributes) => ({ 'data-use-24-hour': String(Boolean(attributes.use24Hour)) }) },
      dateFormat: { default: 'relative', parseHTML: (element) => element.getAttribute('data-date-format') ?? 'relative', renderHTML: (attributes) => ({ 'data-date-format': attributes.dateFormat ?? 'relative' }) },
      openPicker: { default: false, renderHTML: () => ({}) },
    }
  },
  parseHTML() { return [{ tag: 'span[data-type="date-time-block"]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-type': 'date-time-block', class: 'mybook-date-time-block' }, HTMLAttributes)]
  },
  addNodeView() { return ReactNodeViewRenderer(DateTimeBlockNodeView) },
})

export function handleDateTimeBlockAdjacentDelete(view: EditorView, key: string) {
  if (key !== 'Backspace' && key !== 'Delete') return false

  const { state } = view
  const { selection } = state
  if (selection instanceof NodeSelection && selection.node.type.name === 'dateTimeBlock') {
    view.dispatch(state.tr.deleteSelection())
    return true
  }
  if (!selection.empty) return false

  const adjacent = key === 'Backspace' ? selection.$from.nodeBefore : selection.$from.nodeAfter
  if (adjacent?.type.name === 'dateTimeBlock') {
    const position = key === 'Backspace' ? selection.from - adjacent.nodeSize : selection.from
    view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, position)))
    return true
  }

  // Natively deleting the last character beside the mention can leave the DOM
  // selection in the next textblock. Delete it ourselves and pin the caret to
  // the position directly after the mention.
  if (key === 'Backspace') {
    const { $from } = selection
    const index = $from.index()
    const current = $from.parent.maybeChild(index)
    const previous = index > 0 ? $from.parent.maybeChild(index - 1) : null
    if (current?.isText && current.nodeSize === 1 && $from.textOffset === 1 && previous?.type.name === 'dateTimeBlock') {
      const tr = state.tr.delete(selection.from - 1, selection.from)
      tr.setSelection(TextSelection.create(tr.doc, selection.from - 1))
      view.dispatch(tr)
      return true
    }
  }

  // Some browser/editor positions resolve to the start of the following
  // paragraph after deleting the separator. Treat Backspace there as touching
  // the Date & Time mention at the end of the previous textblock.
  if (key === 'Backspace' && selection.$from.parentOffset === 0) {
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      const parent = selection.$from.node(depth - 1)
      const index = selection.$from.index(depth - 1)
      if (index === 0) continue

      const previousTextblock = parent.child(index - 1)
      if (!previousTextblock.isTextblock) continue

      const meaningfulChildren: { typeName: string; offset: number }[] = []
      previousTextblock.content.forEach((child, offset) => {
        if (child.isText && !(child.text ?? '').trim()) return
        meaningfulChildren.push({ typeName: child.type.name, offset })
      })
      const lastMeaningfulChild = meaningfulChildren.at(-1)
      if (lastMeaningfulChild?.typeName !== 'dateTimeBlock') continue

      const previousTextblockPos = selection.$from.before(depth) - previousTextblock.nodeSize
      const dateTimePos = previousTextblockPos + 1 + lastMeaningfulChild.offset
      view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, dateTimePos)))
      return true
    }
  }

  return false
}

export function dateTimeBlockNode(attrs: { value?: string | null; includeTime?: boolean } = {}) {
  return {
    type: 'dateTimeBlock',
    attrs: {
      value: attrs.value ?? new Date().toISOString(),
      includeTime: attrs.includeTime ?? true,
      endDateEnabled: false,
      endValue: null,
      use24Hour: false,
      dateFormat: 'relative',
      openPicker: true,
    },
  }
}
