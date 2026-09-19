import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { AudioBlockNodeView } from '../AudioBlockNodeView'

export const AudioBlock = Node.create({
  name: 'audioBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) =>
          element.querySelector('audio')?.getAttribute('src') ??
          element.getAttribute('src'),
        renderHTML: (attributes) => ({ src: attributes.src }),
      },
      title: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-title') ??
          element.querySelector('audio')?.getAttribute('title') ??
          element.querySelector('audio')?.getAttribute('aria-label') ??
          '',
        renderHTML: (attributes) => ({ 'data-title': attributes.title ?? '' }),
      },
      width: {
        default: '100%',
        parseHTML: (element) =>
          element.getAttribute('data-width') ??
          element.querySelector('audio')?.getAttribute('width') ??
          '100%',
        renderHTML: (attributes) => ({ 'data-width': attributes.width ?? '100%' }),
      },
      align: {
        default: 'left',
        parseHTML: (element) => element.getAttribute('data-align') ?? 'left',
        renderHTML: (attributes) => ({ 'data-align': attributes.align ?? 'left' }),
      },
      artwork: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-artwork') ?? '',
        renderHTML: (attributes) => ({ 'data-artwork': attributes.artwork ?? '' }),
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
        renderHTML: (attributes) => ({
          'data-show-caption': attributes.showCaption ? 'true' : 'false',
        }),
      },
      provider: {
        default: 'html5',
        parseHTML: (element) => element.getAttribute('data-provider') ?? 'html5',
        renderHTML: (attributes) => ({ 'data-provider': attributes.provider ?? 'html5' }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'figure[data-type="audio"]' },
      { tag: 'audio[src]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, title, align = 'left', caption, showCaption, provider = 'html5' } = HTMLAttributes
    const audioEl: unknown[] = [
      'audio',
      {
        src,
        controls: 'true',
        title: title || 'Audio',
        class: 'mybook-audio',
      },
    ]

    const children: unknown[] = [audioEl]
    if (caption && showCaption !== 'false') {
      children.push(['figcaption', { class: 'mybook-image-caption' }, caption])
    }

    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'audio',
        'data-align': align,
        'data-provider': provider,
        class: 'mybook-audio-block',
      }),
      ...children,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioBlockNodeView)
  },
})

export function audioBlockNode(
  src: string,
  title = '',
  width = '100%',
  align: 'left' | 'center' | 'right' = 'left',
  artwork = '',
  caption = '',
  showCaption = true,
  provider: 'html5' | 'embed' = 'html5'
) {
  return {
    type: 'audioBlock',
    attrs: { src, title, width, align, artwork, caption, showCaption, provider },
  }
}
