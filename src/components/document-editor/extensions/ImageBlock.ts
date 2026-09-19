import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { ImageBlockNodeView } from '../ImageBlockNodeView'

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
      width: {
        default: '100%',
        parseHTML: (element) => element.getAttribute('data-width') ?? element.querySelector('img')?.getAttribute('width') ?? '100%',
        renderHTML: (attributes) => ({ 'data-width': attributes.width ?? '100%' }),
      },
      align: {
        default: 'left',
        parseHTML: (element) => element.getAttribute('data-align') ?? 'left',
        renderHTML: (attributes) => ({ 'data-align': attributes.align ?? 'left' }),
      },
      caption: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-caption') ??
          element.querySelector('figcaption')?.textContent ??
          '',
        renderHTML: (attributes) => ({ 'data-caption': attributes.caption ?? '' }),
      },
      showCaption: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-show-caption') !== 'false',
        renderHTML: (attributes) => ({ 'data-show-caption': attributes.showCaption ? 'true' : 'false' }),
      },
      href: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-href') ??
          element.querySelector('a')?.getAttribute('href') ??
          element.closest('a')?.getAttribute('href') ??
          null,
        renderHTML: (attributes) => ({ 'data-href': attributes.href || undefined }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image"]' }, { tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, width, align = 'left', caption, showCaption, href } = HTMLAttributes
    const imgEl: unknown[] = [
      'img',
      {
        src,
        alt: alt ?? '',
        referrerpolicy: 'no-referrer',
        class: 'mybook-image',
        style: width ? `width: ${width}` : undefined,
      },
    ]
    const imageContent = href ? ['a', { href, class: 'mybook-image-link' }, imgEl] : imgEl
    const children: unknown[] = [imageContent]
    if (caption && showCaption !== 'false') {
      children.push(['figcaption', { class: 'mybook-image-caption' }, caption])
    }
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'image',
        'data-align': align,
        'data-href': href || undefined,
        class: 'mybook-image-block',
      }),
      ...children,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockNodeView)
  },
})

export function imageBlockNode(
  src: string,
  alt = '',
  width = '100%',
  align: 'left' | 'center' | 'right' = 'left',
  caption = '',
  showCaption = true,
  href = ''
) {
  return {
    type: 'imageBlock',
    attrs: { src, alt, width, align, caption, showCaption, href: href || null },
  }
}
