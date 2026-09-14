import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { BookmarkBlockNodeView } from '../BookmarkBlockNodeView'

export const BookmarkBlock = Node.create({
  name: 'bookmarkBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      appearance: {
        default: 'bookmark',
        parseHTML: (element) => element.getAttribute('data-appearance') === 'mention' ? 'mention' : 'bookmark',
        renderHTML: (attributes) => ({ 'data-appearance': attributes.appearance ?? 'bookmark' }),
      },
      siteName: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-site-name') ?? '',
        renderHTML: (attributes) => ({ 'data-site-name': attributes.siteName ?? '' }),
      },
      image: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-image') ?? '',
        renderHTML: (attributes) => ({ 'data-image': attributes.image ?? '' }),
      },
      href: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-href') ?? element.querySelector('a')?.getAttribute('href') ?? '',
        renderHTML: (attributes) => ({ 'data-href': attributes.href ?? '' }),
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') ?? element.querySelector('.mybook-bookmark-title')?.textContent ?? '',
        renderHTML: (attributes) => ({ 'data-title': attributes.title ?? '' }),
      },
      domain: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-domain') ?? element.querySelector('.mybook-bookmark-domain')?.textContent ?? '',
        renderHTML: (attributes) => ({ 'data-domain': attributes.domain ?? '' }),
      },
      description: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-description') ?? element.querySelector('.mybook-bookmark-description')?.textContent ?? '',
        renderHTML: (attributes) => ({ 'data-description': attributes.description ?? '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-type="bookmark"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const href = String(node.attrs.href ?? '')
    const title = String(node.attrs.title ?? '') || href
    const description = String(node.attrs.description ?? '')
    return [
      'section',
      mergeAttributes({ 'data-type': 'bookmark', class: 'mybook-bookmark-block' }, HTMLAttributes),
      ['a', { href, class: 'mybook-bookmark-link' },
        ['span', { class: 'mybook-bookmark-title' }, title],
        description ? ['span', { class: 'mybook-bookmark-description' }, description] : '',
        ['span', { class: 'mybook-bookmark-domain' }, href],
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkBlockNodeView)
  },
})

export function bookmarkBlockNode(attrs: { href: string; title: string; domain: string; description?: string; appearance?: 'bookmark' | 'mention' }) {
  return {
    type: 'bookmarkBlock',
    attrs: {
      href: attrs.href,
      title: attrs.title,
      domain: attrs.domain,
      description: attrs.description ?? '',
      ...(attrs.appearance === 'mention' ? { appearance: 'mention' } : {}),
    },
  }
}
