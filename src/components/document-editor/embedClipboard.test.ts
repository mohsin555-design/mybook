// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import type { Node } from '@tiptap/pm/model'
import { copyEmbedToClipboard, pastedEmbed } from './embedClipboard'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const attrs = { provider: 'youtube', url: 'https://youtu.be/abcdefghijk', embedUrl: 'https://www.youtube.com/embed/abcdefghijk', title: 'Video <title> & "quotes"', description: 'Description' }
const readBlob = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.readAsText(blob)
})

it.each(['youtube', 'web', 'figma', 'google-drive'])('copies and restores a complete %s embed with a plain URL for text-only destinations', async (provider) => {
  const copiedAttrs = { ...attrs, provider }
  let content: Record<string, Blob> = {}
  vi.stubGlobal('ClipboardItem', class { constructor(value: Record<string, Blob>) { content = value } })
  const write = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { write } })
  expect(await copyEmbedToClipboard({ attrs: copiedAttrs } as unknown as Node)).toBe(true)
  expect(write).toHaveBeenCalledOnce()
  expect(pastedEmbed(await readBlob(content['text/html']!))).toEqual({ type: 'embedBlock', attrs: copiedAttrs })
  expect(await readBlob(content['text/plain']!)).toBe(attrs.url)
})

it('falls back to rich native copying if clipboard access fails', async () => {
  vi.stubGlobal('navigator', { clipboard: { write: vi.fn().mockRejectedValue(new Error('Denied')) } })
  const data: Record<string, string> = {}
  Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => {
    const event = new Event('copy', { cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { setData: (type: string, value: string) => { data[type] = value } } })
    document.dispatchEvent(event)
    return true
  }) })
  expect(await copyEmbedToClipboard({ attrs } as unknown as Node)).toBe(true)
  expect(pastedEmbed(data['text/html']!)).toEqual({ type: 'embedBlock', attrs })
  Reflect.deleteProperty(document, 'execCommand')
})

it('ignores ordinary HTML, incomplete embeds and unsafe source URLs', () => {
  expect(pastedEmbed('<p>Text</p>')).toBeNull()
  expect(pastedEmbed('<section data-type="embed" data-provider="web"></section>')).toBeNull()
  expect(pastedEmbed('<section data-type="embed" data-provider="youtube" data-url="https://youtu.be/abcdefghijk" data-embed-url="javascript:alert(1)"></section>')).toBeNull()
})
