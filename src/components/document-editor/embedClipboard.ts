import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

const attributes = ['provider', 'url', 'embedUrl', 'title', 'description'] as const
const htmlAttribute = (name: string) => `data-${name === 'embedUrl' ? 'embed-url' : name}`

export async function copyEmbedToClipboard(node: ProseMirrorNode): Promise<boolean> {
  const element = document.createElement('section')
  element.setAttribute('data-type', 'embed')
  for (const name of attributes) element.setAttribute(htmlAttribute(name), String(node.attrs[name] ?? ''))
  element.textContent = String(node.attrs.url ?? '')
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([element.outerHTML], { type: 'text/html' }),
      'text/plain': new Blob([element.textContent], { type: 'text/plain' }),
    })])
    return true
  } catch {
    // Keep rich block copying available when the async clipboard API is unavailable.
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

export function pastedEmbed(html: string) {
  if (!html) return null
  const document = new DOMParser().parseFromString(html, 'text/html')
  const element = document.body.firstElementChild
  if (document.body.children.length !== 1 || !element?.matches('section[data-type="embed"]')) return null
  const attrs = Object.fromEntries(attributes.map((name) => [name, element.getAttribute(htmlAttribute(name)) ?? ''])) as Record<typeof attributes[number], string>
  if (!attrs.provider) return null
  try {
    if (![attrs.url, attrs.embedUrl].every((value) => ['https:', 'http:'].includes(new URL(value).protocol))) return null
  } catch {
    return null
  }
  return { type: 'embedBlock', attrs }
}
