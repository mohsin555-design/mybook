import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { DocumentLinkNodeView } from '../DocumentLinkNodeView'
import { documentLinkNode } from '../documentLinkModel'

export const DocumentLink = Node.create({
  name: 'documentLink',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      targetId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-target-id') ?? element.getAttribute('targetId'),
        renderHTML: (attributes) => ({ 'data-target-id': attributes.targetId }),
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-label') ?? element.getAttribute('label') ?? element.textContent ?? '',
        renderHTML: (attributes) => ({ 'data-label': attributes.label }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-type="document-link"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, {
      'data-type': 'document-link',
      class: 'mybook-document-link',
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DocumentLinkNodeView)
  },
})

export { documentLinkNode }
