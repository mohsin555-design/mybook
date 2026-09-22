import { mergeAttributes, Node } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') || element.querySelector('.mybook-toggle-title')?.textContent || '',
        renderHTML: (attributes) => ({ 'data-title': String(attributes.title || '') }),
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

      const caret = document.createElement('button')
      caret.type = 'button'
      caret.className = 'mybook-toggle-caret'
      caret.setAttribute('aria-label', 'Toggle expanded state')

      const title = document.createElement('input')
      title.className = 'mybook-toggle-title'
      title.type = 'text'
      title.value = String(node.attrs.title || '')
      title.placeholder = 'Toggle'
      title.setAttribute('aria-label', 'Toggle title')

      const content = document.createElement('div')
      content.className = 'mybook-toggle-content'

      summary.append(caret, title)
      details.append(summary, content)

      const updateAttributes = (attrs: Record<string, unknown>) => {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (typeof pos !== 'number') return
        const currentNode = editor.view.state.doc.nodeAt(pos)
        if (!currentNode) return
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...attrs }))
      }

      const updateCaret = () => {
        caret.textContent = details.open ? '▾' : '▸'
        caret.setAttribute('aria-expanded', String(details.open))
      }
      const handleInput = () => updateAttributes({ title: title.value })
      const handleTitleKeyDown = (event: KeyboardEvent) => {
        event.stopPropagation()
        if (event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault()
          if (details.open && typeof getPos === 'function') {
            const position = getPos()
            if (typeof position === 'number') {
              const bodyPosition = Math.min(position + 1, editor.view.state.doc.content.size)
              editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.near(editor.view.state.doc.resolve(bodyPosition))))
              editor.view.focus()
            }
          }
          return
        }
        if (event.key !== 'Enter') return
        event.preventDefault()
        if (typeof getPos !== 'function') return
        const position = getPos()
        if (typeof position !== 'number') return
        const currentNode = editor.view.state.doc.nodeAt(position)
        if (!currentNode) return
        if (details.open) {
          const bodyPosition = Math.min(position + 1, editor.view.state.doc.content.size)
          editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.near(editor.view.state.doc.resolve(bodyPosition))))
          editor.view.focus()
          return
        }
        const insertPosition = position + currentNode.nodeSize
        const paragraph = editor.schema.nodes.paragraph
        if (!paragraph) return
        editor.view.dispatch(editor.view.state.tr.insert(insertPosition, paragraph.create()))
        editor.view.dispatch(editor.view.state.tr.setSelection(TextSelection.near(editor.view.state.doc.resolve(insertPosition + 1))))
        editor.view.focus()
      }
      const handleCaretClick = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        details.open = !details.open
        updateAttributes({ open: details.open })
        updateCaret()
      }
      const handleSummaryClick = (event: MouseEvent) => {
        if (event.target === summary) event.preventDefault()
      }

      title.addEventListener('input', handleInput)
      title.addEventListener('keydown', handleTitleKeyDown)
      caret.addEventListener('click', handleCaretClick)
      summary.addEventListener('click', handleSummaryClick)
      updateCaret()
      if (!node.attrs.title && typeof getPos === 'function') {
        window.requestAnimationFrame(() => {
          const position = getPos()
          if (typeof position !== 'number') return
          const selection = editor.state.selection
          if (selection.from >= position && selection.to <= position + node.nodeSize) {
            title.focus()
            title.setSelectionRange(0, 0)
          }
        })
      }

      return {
        dom: details,
        contentDOM: content,
        update: (nextNode) => {
          if (nextNode.type.name !== 'toggleBlock') return false
          if (title.value !== nextNode.attrs.title) title.value = String(nextNode.attrs.title || '')
          if (details.open !== nextNode.attrs.open) details.open = nextNode.attrs.open !== false
          updateCaret()
          return true
        },
        destroy: () => {
          title.removeEventListener('input', handleInput)
          title.removeEventListener('keydown', handleTitleKeyDown)
          caret.removeEventListener('click', handleCaretClick)
          summary.removeEventListener('click', handleSummaryClick)
        },
      }
    }
  },
})

export function toggleBlockNode(title = 'Toggle') {
  return {
    type: 'toggleBlock',
    attrs: { title: title === 'Toggle' ? '' : title, open: true },
    content: [{ type: 'paragraph' }],
  }
}
