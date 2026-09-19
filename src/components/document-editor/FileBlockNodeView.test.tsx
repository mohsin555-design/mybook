// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'

import { FileBlockNodeView } from './FileBlockNodeView'

describe('FileBlockNodeView', () => {
  let mockEditor: unknown
  let mockNode: {
    attrs: {
      src: string
      name: string
      mimeType: string
      size: number
    }
    nodeSize: number
    toJSON: () => unknown
  }
  let updateAttributes: (attributes: Record<string, unknown>) => void
  let deleteNode: () => void
  let getPos: () => number | undefined

  beforeEach(() => {
    updateAttributes = vi.fn() as unknown as (attributes: Record<string, unknown>) => void
    deleteNode = vi.fn() as unknown as () => void
    getPos = vi.fn(() => 10) as unknown as () => number | undefined

    mockEditor = {
      view: { focus: vi.fn() },
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          insertContentAt: vi.fn(() => ({
            run: vi.fn(),
          })),
          deleteRange: vi.fn(() => ({
            run: vi.fn(),
          })),
        })),
      })),
    }

    mockNode = {
      attrs: {
        src: 'https://example.com/files/spec.pdf',
        name: 'spec.pdf',
        mimeType: 'application/pdf',
        size: 2450000,
      },
      nodeSize: 1,
      toJSON: () => ({
        type: 'fileAttachment',
        attrs: mockNode.attrs,
      }),
    }

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function createProps(customNode = mockNode, selected = false): NodeViewProps {
    return {
      editor: mockEditor,
      node: customNode,
      updateAttributes,
      deleteNode,
      getPos,
      selected,
      decorations: [],
      extension: {} as unknown,
      HTMLAttributes: {},
      view: (mockEditor as { view: unknown }).view,
      innerDecorations: [] as unknown,
    } as unknown as NodeViewProps
  }

  it('renders file card with file name, metadata, and top-right actions', () => {
    render(<FileBlockNodeView {...createProps()} />)

    expect(screen.getByText('spec')).toBeInTheDocument()
    expect(screen.getByText(/PDF · 2\.3 MB/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy block' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More file options' })).toBeInTheDocument()
  })

  it('renders appropriate metadata for URL-based link without size', () => {
    const urlNode = {
      ...mockNode,
      attrs: {
        src: 'https://example.com/spreadsheet.xlsx',
        name: 'spreadsheet.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 0,
      },
    }

    render(<FileBlockNodeView {...createProps(urlNode)} />)

    expect(screen.getByText('spreadsheet')).toBeInTheDocument()
    expect(screen.getByText(/XLSX · (example\.com|Link)/i)).toBeInTheDocument()
  })

  it('duplicates the file block when Duplicate action is triggered', () => {
    render(<FileBlockNodeView {...createProps()} />)

    const duplicateBtn = screen.getByRole('button', { name: 'Duplicate' })
    fireEvent.click(duplicateBtn)

    expect((mockEditor as { chain: unknown }).chain).toHaveBeenCalled()
  })

  it('deletes the file block when Delete action is triggered from More menu', async () => {
    render(<FileBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: 'More file options' })
    fireEvent.click(moreBtn)

    const deleteMenuItem = screen.getByRole('menuitem', { name: 'Delete' })
    fireEvent.click(deleteMenuItem)

    expect(deleteNode).toHaveBeenCalledTimes(1)
  })

  it('copies file URL to clipboard when Copy link is clicked for URL files', async () => {
    render(<FileBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: 'More file options' })
    fireEvent.click(moreBtn)

    const copyLinkItem = screen.getByRole('menuitem', { name: 'Copy link' })
    fireEvent.click(copyLinkItem)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/files/spec.pdf')
    })
  })

  it('opens Replace file popover when Replace action is clicked', () => {
    render(<FileBlockNodeView {...createProps()} />)

    const replaceBtn = screen.getByRole('button', { name: 'Replace file' })
    fireEvent.click(replaceBtn)

    expect(screen.getByRole('dialog', { name: 'Replace file' })).toBeInTheDocument()
  })

  it('opens Edit link popover and updates attributes when new URL is saved', () => {
    render(<FileBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: 'More file options' })
    fireEvent.click(moreBtn)

    const editLinkMenuItem = screen.getByRole('menuitem', { name: 'Edit link' })
    fireEvent.click(editLinkMenuItem)

    const dialog = screen.getByRole('dialog', { name: 'Edit file link' })
    expect(dialog).toBeInTheDocument()

    const input = screen.getByLabelText('File URL')
    fireEvent.change(input, { target: { value: 'https://example.com/downloads/new-document.docx' } })

    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)

    expect(updateAttributes).toHaveBeenCalledWith({
      src: 'https://example.com/downloads/new-document.docx',
      name: 'new-document.docx',
      size: 0,
      mimeType: '',
    })
  })
})
