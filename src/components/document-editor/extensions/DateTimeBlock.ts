import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { DateTimeBlockNodeView } from '../DateTimeBlockNodeView'

export const DateTimeBlock = Node.create({
  name: 'dateTimeBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      value: { default: null, parseHTML: (element) => element.getAttribute('data-value'), renderHTML: (attributes) => attributes.value ? { 'data-value': attributes.value } : {} },
      includeTime: { default: false, parseHTML: (element) => element.getAttribute('data-include-time') === 'true', renderHTML: (attributes) => ({ 'data-include-time': String(Boolean(attributes.includeTime)) }) },
    }
  },
  parseHTML() { return [{ tag: 'div[data-type="date-time-block"]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'date-time-block', class: 'mybook-date-time-block' }, HTMLAttributes)]
  },
  addNodeView() { return ReactNodeViewRenderer(DateTimeBlockNodeView) },
})

export function dateTimeBlockNode(attrs: { value?: string | null; includeTime?: boolean } = {}) {
  return { type: 'dateTimeBlock', attrs: { value: attrs.value ?? null, includeTime: attrs.includeTime ?? false } }
}
