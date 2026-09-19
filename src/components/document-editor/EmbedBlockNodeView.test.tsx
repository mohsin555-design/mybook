// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'
import { EmbedBlockNodeView } from './EmbedBlockNodeView'
import { copyEmbedToClipboard } from './embedClipboard'
import { getBookmarkMetadata } from '../../services/bookmarkMetadata'

vi.mock('@tiptap/react', () => ({ NodeViewWrapper: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }))
vi.mock('./embedClipboard', () => ({ copyEmbedToClipboard: vi.fn().mockResolvedValue(true) }))
vi.mock('../../services/bookmarkMetadata', () => ({ getBookmarkMetadata: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks() })

it('replaces the URL-derived embed title with the page title', async () => {
  vi.mocked(getBookmarkMetadata).mockResolvedValue({ title: 'Actual page title', description: 'Page description', image: '' })
  const updateAttributes = vi.fn()
  const props = { node: { attrs: { url: 'https://example.com/search?q=delete', title: 'search' } }, updateAttributes } as unknown as NodeViewProps
  render(<EmbedBlockNodeView {...props} />)
  await waitFor(() => expect(updateAttributes).toHaveBeenCalledWith({ title: 'Actual page title', description: 'Page description' }))
  expect(getBookmarkMetadata).toHaveBeenCalledWith('https://example.com/search?q=delete')
})

it('displays the description with full text on hover and hides the URL', () => {
  vi.mocked(getBookmarkMetadata).mockResolvedValue(null)
  const url = 'https://example.com/search?q=delete'
  const description = 'A detailed page description'
  const props = { node: { attrs: { url, title: 'Page', description } }, updateAttributes: vi.fn() } as unknown as NodeViewProps
  const { getByText, queryByText } = render(<EmbedBlockNodeView {...props} />)
  expect(getByText(description).getAttribute('title')).toBe(description)
  expect(queryByText(url)).toBeNull()
})

it('keeps the existing title when metadata is unavailable', async () => {
  vi.mocked(getBookmarkMetadata).mockResolvedValue(null)
  const updateAttributes = vi.fn()
  const props = { node: { attrs: { url: 'https://example.com', title: 'Existing title' } }, updateAttributes } as unknown as NodeViewProps
  const { findByText } = render(<EmbedBlockNodeView {...props} />)
  expect(await findByText('Existing title')).toBeTruthy()
  expect(updateAttributes).not.toHaveBeenCalled()
})

function renderVideo() {
  vi.mocked(getBookmarkMetadata).mockResolvedValue(null)
  const insertContentAt = vi.fn()
  const node = { attrs: { provider: 'youtube', url: 'https://youtu.be/abcdefghijk', embedUrl: 'https://www.youtube.com/embed/abcdefghijk', title: 'Video title', description: 'Video description' }, nodeSize: 1, toJSON: () => ({ type: 'embedBlock' }) }
  const props = { node, getPos: () => 4, editor: { commands: { insertContentAt } }, updateAttributes: vi.fn() } as unknown as NodeViewProps
  render(<EmbedBlockNodeView {...props} />)
  return { insertContentAt, node }
}

it('shows a headerless video with fullscreen, copy and reload actions and no resizing or replacement', async () => {
  renderVideo()
  expect(screen.queryByText('Video title')).toBeNull()
  expect(screen.queryByText('Video description')).toBeNull()
  expect(screen.queryByRole('slider')).toBeNull()
  expect(screen.queryByRole('button', { name: /replace|align/i })).toBeNull()
  const iframe = screen.getByTitle('Video title')
  fireEvent.click(screen.getByRole('button', { name: 'Reload video' }))
  expect(screen.getByTitle('Video title')).not.toBe(iframe)
  const player = screen.getByTitle('Video title')
  player.requestFullscreen = vi.fn().mockResolvedValue(undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
  expect(player.requestFullscreen).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).toBeNull()
  await Promise.resolve()
})

it('orders toolbar and More actions and duplicates the embed from the toolbar', async () => {
  const { insertContentAt, node } = renderVideo()
  expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Reload video', 'Full screen', 'Copy block', 'Duplicate', 'More actions for Video title'])
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
  expect(insertContentAt).toHaveBeenCalledWith(5, node.toJSON())
  fireEvent.click(screen.getByRole('button', { name: 'Copy block' }))
  expect(copyEmbedToClipboard).toHaveBeenCalledWith(node)
  await screen.findByRole('button', { name: 'Copied' })
  fireEvent.click(screen.getByRole('button', { name: 'More actions for Video title' }))
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open', 'Copy link', 'Change to', 'Remove link', 'Delete'])
  const writeText = vi.fn()
  Object.assign(navigator, { clipboard: { writeText } })
  fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }))
  expect(writeText).toHaveBeenCalledWith(node.attrs.url)
})

it('restores Remove link after Change to and leaves the original plain URL', () => {
  const { insertContentAt, node } = renderVideo()
  const more = screen.getByRole('button', { name: 'More actions for Video title' })
  expect(more.classList.contains('mybook-image-toolbar-button')).toBe(true)
  fireEvent.click(more)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Remove link' }))
  expect(insertContentAt).toHaveBeenCalledWith({ from: 4, to: 5 }, { type: 'paragraph', content: [{ type: 'text', text: node.attrs.url }] })
})

function renderPageEmbed() {
  vi.mocked(getBookmarkMetadata).mockResolvedValue(null)
  const node = { attrs: { provider: 'web', url: 'https://example.com', embedUrl: 'https://example.com', title: 'Page title', description: 'Page description' }, nodeSize: 1, toJSON: () => ({ type: 'embedBlock' }) }
  const insertContentAt = vi.fn()
  render(<EmbedBlockNodeView {...{
    node, getPos: () => 4, editor: { commands: { insertContentAt } },
    updateAttributes: vi.fn(),
  } as unknown as NodeViewProps} />)
  const iframe = screen.getByTitle('Page title')
  const card = iframe.closest('[data-slot="card"]') as HTMLDivElement
  return { iframe, card, node, insertContentAt }
}

it('expands a non-video embed with its header and replaces More with Exit fullscreen', async () => {
  const { iframe, card } = renderPageEmbed()
  let fullscreenElement: Element | null = null
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement })
  card.requestFullscreen = vi.fn(async () => {
    fullscreenElement = card
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: vi.fn(async () => {
    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
  }) })
  fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
  const exit = await screen.findByRole('button', { name: 'Exit fullscreen' })
  expect(card.requestFullscreen).toHaveBeenCalledOnce()
  expect(screen.getByText('Page title')).toBeTruthy()
  expect(screen.getByText('Page description')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'More actions for Page title' })).toBeNull()
  expect(screen.getByTitle('Page title')).toBe(iframe)
  fireEvent.click(exit)
  await screen.findByRole('button', { name: 'More actions for Page title' })
  expect(document.exitFullscreen).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'Exit fullscreen' })).toBeNull()

  // Browser Escape exits fullscreen independently of the header button.
  fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
  await screen.findByRole('button', { name: 'Exit fullscreen' })
  act(() => {
    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
  })
  expect(screen.getByRole('button', { name: 'More actions for Page title' })).toBeTruthy()
  expect(screen.getByTitle('Page title')).toBe(iframe)
  Reflect.deleteProperty(document, 'fullscreenElement')
  Reflect.deleteProperty(document, 'exitFullscreen')
})

it('keeps the normal embed controls when fullscreen is denied', async () => {
  const { card } = renderPageEmbed()
  card.requestFullscreen = vi.fn().mockRejectedValue(new Error('Denied'))
  fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'More actions for Page title' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Exit fullscreen' })).toBeNull()
})

it('shows ordered plain header actions and the compact More menu for non-video embeds', async () => {
  const { node, insertContentAt } = renderPageEmbed()
  const header = screen.getByRole('button', { name: 'Reload' }).parentElement!
  expect(Array.from(header.querySelectorAll('button')).map((button) => button.getAttribute('aria-label'))).toEqual(['Reload', 'Full screen', 'Copy block', 'Duplicate', 'More actions for Page title'])
  expect(header.classList.contains('mybook-image-block-toolbar')).toBe(false)
  const oldIframe = screen.getByTitle('Page title')
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
  expect(screen.getByTitle('Page title')).not.toBe(oldIframe)
  fireEvent.click(screen.getByRole('button', { name: 'Copy block' }))
  expect(copyEmbedToClipboard).toHaveBeenCalledWith(node)
  await screen.findByRole('button', { name: 'Copied' })
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
  expect(insertContentAt).toHaveBeenCalledWith(5, node.toJSON())
  fireEvent.click(screen.getByRole('button', { name: 'More actions for Page title' }))
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open', 'Copy link', 'Change to', 'Remove link', 'Delete'])
})
