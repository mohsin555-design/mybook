// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'
import { BookmarkBlockNodeView } from './BookmarkBlockNodeView'
import { copyBookmarkToClipboard } from './bookmarkClipboard'
import { getBookmarkMetadata } from '../../services/bookmarkMetadata'

vi.mock('@tiptap/react', () => ({ NodeViewWrapper: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }))
vi.mock('./bookmarkClipboard', () => ({ copyBookmarkToClipboard: vi.fn().mockResolvedValue(true) }))
vi.mock('../../services/bookmarkMetadata', () => ({ getBookmarkMetadata: vi.fn(async () => null) }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('bookmark preview', () => {
  const href = 'https://example.com/icons?search=delete'
  function props(image = '') {
    const insertContentAt = vi.fn()
    return {
      node: { attrs: { href, title: 'Page title', description: 'Page description', image }, nodeSize: 1, toJSON: () => ({ type: 'bookmarkBlock' }) },
      getPos: () => 4,
      editor: { commands: { insertContentAt } },
      updateAttributes: vi.fn(),
      selected: false,
    } as unknown as NodeViewProps
  }
  it('shows the original URL and a centered icon when there is no image', () => {
    const { container } = render(<BookmarkBlockNodeView {...props()} />)
    expect(screen.getByText(href)).toBeTruthy()
    expect(screen.getByText('Page description')).toBeTruthy()
    expect(container.querySelector('.mybook-bookmark-logo svg')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })
  it('reveals a loaded preview and falls back when loading fails', () => {
    const { container } = render(<BookmarkBlockNodeView {...props('https://example.com/preview.png')} />)
    const img = container.querySelector('img')!
    expect(img.className).not.toContain('is-loaded')
    fireEvent.load(img)
    expect(img.className).toContain('is-loaded')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.mybook-bookmark-logo svg')).toBeTruthy()
  })
  it('renders a website mention with its favicon, site name, and page title', () => {
    const nodeProps = props()
    const attrs = nodeProps.node.attrs as Record<string, unknown>
    attrs.appearance = 'mention'
    attrs.siteName = 'Example'
    const { container } = render(<BookmarkBlockNodeView {...nodeProps} />)
    expect(screen.getByText('Example')).toBeTruthy()
    expect(screen.getByText('Page title')).toBeTruthy()
    expect(screen.queryByText('Page description')).toBeNull()
    expect(screen.queryByText(href)).toBeNull()
    expect(container.querySelector('img')?.src).toContain('google.com/s2/favicons')
    expect(container.querySelector('.mybook-mention-block')).toBeTruthy()
  })
  it('saves fetched metadata without changing the pasted URL', async () => {
    const metadata = { title: 'Actual page', description: 'Actual description', image: 'https://example.com/og.png' }
    vi.mocked(getBookmarkMetadata).mockResolvedValueOnce(metadata)
    const nodeProps = props()
    render(<BookmarkBlockNodeView {...nodeProps} />)
    await waitFor(() => expect(nodeProps.updateAttributes).toHaveBeenCalledWith(metadata))
    expect(screen.getByText(href)).toBeTruthy()
  })
  it('orders bookmark action buttons (Copy, Duplicate, More) and More menu items', async () => {
    const nodeProps = props()
    render(<BookmarkBlockNodeView {...nodeProps} />)

    const buttons = screen.getAllByRole('button').filter((b) => b.classList.contains('mybook-image-toolbar-button'))
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Copy block', 'Duplicate', 'More actions for Page title'])

    // 1. Copy
    fireEvent.click(screen.getByRole('button', { name: 'Copy block' }))
    expect(copyBookmarkToClipboard).toHaveBeenCalledWith(nodeProps.node)
    await screen.findByRole('button', { name: 'Copied' })

    // 2. Duplicate
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(nodeProps.editor.commands.insertContentAt).toHaveBeenCalledWith(5, nodeProps.node.toJSON())

    // 3. More
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Page title' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open', 'Copy link', 'Change to', 'Remove link', 'Delete'])
  })
})
