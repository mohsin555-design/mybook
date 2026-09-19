import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

const bookmarkAttributes = ['appearance', 'siteName', 'image', 'href', 'title', 'domain', 'description'] as const
const bookmarkHtmlAttribute = (name: string) => {
  if (name === 'siteName') return 'data-site-name'
  return `data-${name}`
}

export async function copyBookmarkToClipboard(node: ProseMirrorNode): Promise<boolean> {
  const element = document.createElement('section')
  element.setAttribute('data-type', 'bookmark')
  for (const name of bookmarkAttributes) {
    const val = node.attrs[name]
    if (val) element.setAttribute(bookmarkHtmlAttribute(name), String(val))
  }
  element.textContent = String(node.attrs.href ?? '')
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([element.outerHTML], { type: 'text/html' }),
      'text/plain': new Blob([element.textContent], { type: 'text/plain' }),
    })])
    return true
  } catch {
    const onCopy = (event: ClipboardEvent) => {
      if (!event.clipboardData) return
      event.preventDefault()
      event.clipboardData.setData('text/html', element.outerHTML)
      event.clipboardData.setData('text/plain', element.textContent ?? '')
    }
    document.addEventListener('copy', onCopy)
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.removeEventListener('copy', onCopy)
    }
  }
}

export function pastedBookmark(html: string) {
  if (!html) return null
  const document = new DOMParser().parseFromString(html, 'text/html')
  const element = document.body.firstElementChild
  if (document.body.children.length !== 1 || !element?.matches('section[data-type="bookmark"]')) return null
  const attrs = Object.fromEntries(
    bookmarkAttributes.map((name) => [name, element.getAttribute(bookmarkHtmlAttribute(name)) ?? ''])
  ) as Record<typeof bookmarkAttributes[number], string>
  if (!attrs.href) return null
  try {
    if (!['https:', 'http:'].includes(new URL(attrs.href).protocol)) return null
  } catch {
    return null
  }
  return { type: 'bookmarkBlock', attrs }
}
