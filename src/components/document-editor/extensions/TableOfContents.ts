import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { TableOfContentsNodeView } from '../TableOfContentsNodeView'
import { tableOfContentsNode } from '../tableOfContentsModel'

export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'nav[data-type="table-of-contents"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['nav', mergeAttributes(HTMLAttributes, {
      'data-type': 'table-of-contents',
      class: 'mybook-table-of-contents',
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsNodeView)
  },
})

export { tableOfContentsNode }
