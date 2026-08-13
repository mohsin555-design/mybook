import { mergeAttributes, Node } from '@tiptap/core'

export const calloutKinds = ['info', 'success', 'warning'] as const
export type CalloutKind = typeof calloutKinds[number]

function normalizeKind(value: unknown): CalloutKind {
  return calloutKinds.includes(value as CalloutKind) ? value as CalloutKind : 'info'
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'info',
        parseHTML: (element) => normalizeKind(element.getAttribute('data-kind')),
        renderHTML: (attributes) => ({ 'data-kind': normalizeKind(attributes.kind) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'aside[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'callout',
        class: 'mybook-callout',
      }),
      ['div', { class: 'mybook-callout-content' }, 0],
    ]
  },
})

export function calloutNode(kind: CalloutKind = 'info') {
  return {
    type: 'callout',
    attrs: { kind },
    content: [{ type: 'paragraph' }],
  }
}
