import { mergeAttributes, Node } from '@tiptap/core'

export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.querySelector('img')?.getAttribute('src') ?? element.getAttribute('src'),
        renderHTML: (attributes) => ({ src: attributes.src }),
      },
      alt: {
        default: '',
        parseHTML: (element) => element.querySelector('img')?.getAttribute('alt') ?? element.getAttribute('alt') ?? '',
        renderHTML: (attributes) => ({ alt: attributes.alt ?? '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image"]' }, { tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt } = HTMLAttributes
    return [
      'figure',
      mergeAttributes({ 'data-type': 'image', class: 'mybook-image-block' }),
      ['img', { src, alt: alt ?? '', class: 'mybook-image' }],
    ]
  },
})

export function imageBlockNode(src: string, alt = '') {
  return {
    type: 'imageBlock',
    attrs: { src, alt },
  }
}
