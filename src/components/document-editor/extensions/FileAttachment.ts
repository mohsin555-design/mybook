import { mergeAttributes, Node } from '@tiptap/core'

export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      name: {
        default: 'Attachment',
        parseHTML: (element) => element.getAttribute('data-name') ?? 'Attachment',
        renderHTML: (attributes) => ({ 'data-name': attributes.name ?? 'Attachment' }),
      },
      mimeType: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mime-type') ?? '',
        renderHTML: (attributes) => ({ 'data-mime-type': attributes.mimeType ?? '' }),
      },
      size: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('data-size') ?? 0),
        renderHTML: (attributes) => ({ 'data-size': attributes.size ?? 0 }),
      },
      src: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-src') ?? element.querySelector('a')?.getAttribute('href') ?? '',
        renderHTML: (attributes) => ({ 'data-src': attributes.src ?? '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-type="file-attachment"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name ?? 'Attachment')
    const src = String(node.attrs.src ?? '')
    const mimeType = String(node.attrs.mimeType ?? '')
    const size = Number(node.attrs.size ?? 0)
    return [
      'section',
      mergeAttributes(
        {
          'data-type': 'file-attachment',
          class: 'mybook-file-attachment',
        },
        HTMLAttributes,
      ),
      ['a', { href: src, download: name, class: 'mybook-file-attachment-link' }, name],
      ['span', { class: 'mybook-file-attachment-meta' }, [mimeType, formatAttachmentSize(size)].filter(Boolean).join(' · ')],
    ]
  },
})

export function fileAttachmentNode(src: string, name: string, mimeType = '', size = 0) {
  return {
    type: 'fileAttachment',
    attrs: { src, name, mimeType, size },
  }
}

export function formatAttachmentSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
