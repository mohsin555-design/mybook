import { mergeAttributes, Node } from '@tiptap/core'

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      title: {
        default: 'Toggle',
        parseHTML: (element) => element.getAttribute('data-title') || element.querySelector('summary')?.textContent || 'Toggle',
        renderHTML: (attributes) => ({ 'data-title': String(attributes.title || 'Toggle') }),
      },
      open: {
        default: true,
        parseHTML: (element) => element.hasAttribute('open'),
        renderHTML: (attributes) => (attributes.open ? { open: '' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'details[data-type="toggle"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toggle',
        class: 'mybook-toggle',
      }),
      ['summary', { class: 'mybook-toggle-summary' }, String(node.attrs.title || 'Toggle')],
      ['div', { class: 'mybook-toggle-content' }, 0],
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const details = document.createElement('details')
      details.className = 'mybook-toggle'
      details.dataset.type = 'toggle'
      if (node.attrs.open !== false) details.open = true

      const summary = document.createElement('summary')
      summary.className = 'mybook-toggle-summary'

      const input = document.createElement('input')
      input.className = 'mybook-toggle-title'
      input.value = String(node.attrs.title || 'Toggle')
      input.setAttribute('aria-label', 'Toggle title')

      const content = document.createElement('div')
      content.className = 'mybook-toggle-content'

      summary.append(input)
      details.append(summary, content)

      const updateAttributes = (attrs: Record<string, unknown>) => {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (typeof pos !== 'number') return
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }))
      }

      const handleInput = () => updateAttributes({ title: input.value || 'Toggle' })
      const handleToggle = () => updateAttributes({ open: details.open })

      input.addEventListener('input', handleInput)
      details.addEventListener('toggle', handleToggle)

      return {
        dom: details,
        contentDOM: content,
        update: (nextNode) => {
          if (nextNode.type.name !== 'toggleBlock') return false
          if (input.value !== nextNode.attrs.title) input.value = String(nextNode.attrs.title || 'Toggle')
          if (details.open !== nextNode.attrs.open) details.open = nextNode.attrs.open !== false
          return true
        },
        destroy: () => {
          input.removeEventListener('input', handleInput)
          details.removeEventListener('toggle', handleToggle)
        },
      }
    }
  },
})

export function toggleBlockNode(title = 'Toggle') {
  return {
    type: 'toggleBlock',
    attrs: { title, open: true },
    content: [{ type: 'paragraph' }],
  }
}
