// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import type { Node } from '@tiptap/pm/model'
import { copyBookmarkToClipboard, pastedBookmark } from './bookmarkClipboard'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const attrs = {
  href: 'https://example.com/test',
  title: 'Test Bookmark',
  domain: 'example.com',
  description: 'Test Description',
  image: 'https://example.com/image.png',
  siteName: 'Example Site',
  appearance: 'bookmark',
}
const readBlob = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.readAsText(blob)
})

it('copies and restores a complete bookmark with a plain URL for text-only destinations', async () => {
  let content: Record<string, Blob> = {}
  vi.stubGlobal('ClipboardItem', class { constructor(value: Record<string, Blob>) { content = value } })
  const write = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { write } })
  expect(await copyBookmarkToClipboard({ attrs } as unknown as Node)).toBe(true)
  expect(write).toHaveBeenCalledOnce()
  expect(pastedBookmark(await readBlob(content['text/html']!))).toEqual({ type: 'bookmarkBlock', attrs })
  expect(await readBlob(content['text/plain']!)).toBe(attrs.href)
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
  expect(await copyBookmarkToClipboard({ attrs } as unknown as Node)).toBe(true)
  expect(pastedBookmark(data['text/html']!)).toEqual({ type: 'bookmarkBlock', attrs })
  Reflect.deleteProperty(document, 'execCommand')
})

it('ignores ordinary HTML, incomplete bookmarks and unsafe source URLs', () => {
  expect(pastedBookmark('<p>Text</p>')).toBeNull()
  expect(pastedBookmark('<section data-type="bookmark"></section>')).toBeNull()
  expect(pastedBookmark('<section data-type="bookmark" data-href="javascript:alert(1)"></section>')).toBeNull()
})
