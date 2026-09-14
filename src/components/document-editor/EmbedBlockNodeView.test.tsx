// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'
import { EmbedBlockNodeView } from './EmbedBlockNodeView'
import { getBookmarkMetadata } from '../../services/bookmarkMetadata'

vi.mock('@tiptap/react', () => ({ NodeViewWrapper: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }))
vi.mock('./LinkBlockActions', () => ({ LinkBlockActions: () => null }))
vi.mock('../../services/bookmarkMetadata', () => ({ getBookmarkMetadata: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

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
