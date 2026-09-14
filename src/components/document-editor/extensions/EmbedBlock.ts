import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { EmbedBlockNodeView } from '../EmbedBlockNodeView'

export const EmbedBlock = Node.create({
  name: 'embedBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      description: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-description') ?? '',
        renderHTML: (attributes) => ({ 'data-description': attributes.description ?? '' }),
      },
      provider: {
        default: 'youtube',
        parseHTML: (element) => element.getAttribute('data-provider') ?? 'youtube',
        renderHTML: (attributes) => ({ 'data-provider': attributes.provider ?? 'youtube' }),
      },
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') ?? element.querySelector('a')?.getAttribute('href') ?? '',
        renderHTML: (attributes) => ({ 'data-url': attributes.url ?? '' }),
      },
      embedUrl: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-embed-url') ?? element.querySelector('iframe')?.getAttribute('src') ?? '',
        renderHTML: (attributes) => ({ 'data-embed-url': attributes.embedUrl ?? '' }),
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') ?? element.querySelector('iframe')?.getAttribute('title') ?? '',
        renderHTML: (attributes) => ({ 'data-title': attributes.title ?? '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-type="embed"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const url = String(node.attrs.url ?? '')
    const embedUrl = String(node.attrs.embedUrl ?? '')
    const title = String(node.attrs.title ?? '') || 'Embedded content'
    return [
      'section',
      mergeAttributes({ 'data-type': 'embed', class: 'mybook-embed-block' }, HTMLAttributes),
      ['div', { class: 'mybook-embed-frame' },
        ['iframe', {
          src: embedUrl,
          title,
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          allowfullscreen: 'true',
          loading: 'lazy',
        }],
      ],
      ['a', { href: url, class: 'mybook-embed-source' }, title],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedBlockNodeView)
  },
})

export function embedBlockNode(attrs: { provider: string; url: string; embedUrl: string; title?: string }) {
  return {
    type: 'embedBlock',
    attrs: {
      provider: attrs.provider,
      url: attrs.url,
      embedUrl: attrs.embedUrl,
      title: attrs.title || 'Embedded content',
    },
  }
}

export function youtubeEmbedBlockNode(attrs: { url: string; youtubeId: string; title?: string }) {
  return embedBlockNode({
    provider: 'youtube',
    url: attrs.url,
    embedUrl: `https://www.youtube.com/embed/${attrs.youtubeId}`,
    title: attrs.title || 'YouTube video',
  })
}
