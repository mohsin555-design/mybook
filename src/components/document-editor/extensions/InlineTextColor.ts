import { Mark, mergeAttributes } from '@tiptap/core'

export const InlineTextColor = Mark.create({
  name: 'textColor',
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.color || null,
        renderHTML: (attributes: { color?: string | null }) => attributes.color ? { style: `color: ${attributes.color};` } : {},
      },
    }
  },
  parseHTML() { return [{ tag: 'span[style*=color]' }] },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0] },
})

export const InlineHighlight = Mark.create({
  name: 'highlight',
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
        renderHTML: (attributes: { color?: string | null }) => attributes.color ? { style: `background-color: ${attributes.color};` } : {},
      },
    }
  },
  parseHTML() {
    return [
      { tag: 'mark', getAttrs: (element) => ({ color: (element as HTMLElement).style.backgroundColor || null }) },
      { tag: 'span[style*=background-color]', getAttrs: (element) => ({ color: (element as HTMLElement).style.backgroundColor || null }) },
    ]
  },
  renderHTML({ HTMLAttributes }) { return ['mark', mergeAttributes(HTMLAttributes), 0] },
})
