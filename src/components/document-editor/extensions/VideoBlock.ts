import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { VideoBlockNodeView } from '../VideoBlockNodeView'

export const VideoBlock = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) =>
          element.querySelector('video')?.getAttribute('src') ??
          element.querySelector('iframe')?.getAttribute('src') ??
          element.getAttribute('src'),
        renderHTML: (attributes) => ({ src: attributes.src }),
      },
      alt: {
        default: '',
        parseHTML: (element) =>
          element.querySelector('video')?.getAttribute('aria-label') ??
          element.querySelector('iframe')?.getAttribute('title') ??
          element.getAttribute('data-alt') ??
          '',
        renderHTML: (attributes) => ({ 'data-alt': attributes.alt ?? '' }),
      },
      width: {
        default: '100%',
        parseHTML: (element) =>
          element.getAttribute('data-width') ??
          element.querySelector('video')?.getAttribute('width') ??
          '100%',
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
        renderHTML: (attributes) => ({
          'data-show-caption': attributes.showCaption ? 'true' : 'false',
        }),
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
      provider: {
        default: 'html5',
        parseHTML: (element) => element.getAttribute('data-provider') ?? 'html5',
        renderHTML: (attributes) => ({ 'data-provider': attributes.provider ?? 'html5' }),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'figure[data-type="video"]' },
      { tag: 'video[src]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, width, align = 'left', caption, showCaption, href, provider = 'html5' } = HTMLAttributes
    const isEmbed = provider === 'youtube' || provider === 'vimeo' || provider === 'embed'
    const videoEl: unknown[] = isEmbed
      ? [
          'iframe',
          {
            src,
            title: alt || 'Video',
            class: 'mybook-video-frame',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
            allowfullscreen: 'true',
            style: width ? `width: ${width}` : undefined,
          },
        ]
      : [
          'video',
          {
            src,
            controls: 'true',
            class: 'mybook-video',
            style: width ? `width: ${width}` : undefined,
          },
        ]

    const videoContent = href ? ['a', { href, class: 'mybook-video-link' }, videoEl] : videoEl
    const children: unknown[] = [videoContent]
    if (caption && showCaption !== 'false') {
      children.push(['figcaption', { class: 'mybook-video-caption' }, caption])
    }

    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'video',
        'data-align': align,
        'data-href': href || undefined,
        'data-provider': provider,
        class: 'mybook-video-block',
      }),
      ...children,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoBlockNodeView)
  },
})

export function videoBlockNode(
  src: string,
  alt = '',
  width = '100%',
  align: 'left' | 'center' | 'right' = 'left',
  caption = '',
  showCaption = true,
  href = '',
  provider: 'html5' | 'youtube' | 'vimeo' | 'embed' = 'html5'
) {
  return {
    type: 'videoBlock',
    attrs: { src, alt, width, align, caption, showCaption, href: href || null, provider },
  }
}
