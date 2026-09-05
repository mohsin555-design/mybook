import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { DatabaseBlockNodeView } from '../DatabaseBlockNodeView'
import { createDefaultDatabase, databaseBlockNode } from '../databaseModel'

export const DatabaseBlock = Node.create({
  name: 'databaseBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      version: { default: 1 },
      id: { default: null },
      title: { default: 'Untitled database' },
      columns: { default: null },
      rows: { default: null },
      viewState: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-type="database-block"]' }]
  },

  renderHTML() {
    return ['section', mergeAttributes({
      'data-type': 'database-block',
      class: 'mybook-database-block',
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseBlockNodeView)
  },
})

export { createDefaultDatabase, databaseBlockNode }
