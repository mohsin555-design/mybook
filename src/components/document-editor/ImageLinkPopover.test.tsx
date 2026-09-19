// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MyBookFile } from '../../types/files'
import { DocumentLinkProvider } from './DocumentLinkContext'
import { ImageLinkPopover } from './ImageLinkPopover'

afterEach(() => {
  cleanup()
})

const mockFiles: MyBookFile[] = [
  {
    id: 'doc-1',
    driveFileId: null,
    name: 'Project Roadmap',
    type: 'document',
    content: '',
    folderId: null,
    mimeType: 'text/markdown',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
    lastSyncedAt: null,
    isDeleted: false,
    syncStatus: 'local',
  },
  {
    id: 'doc-2',
    driveFileId: null,
    name: 'Budget 2026',
    type: 'spreadsheet',
    content: '',
    folderId: null,
    mimeType: 'application/json',
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-04T00:00:00Z',
    lastSyncedAt: null,
    isDeleted: false,
    syncStatus: 'local',
  },
  {
    id: 'doc-3',
    driveFileId: null,
    name: 'Architecture Notes',
    type: 'document',
    content: '',
    folderId: null,
    mimeType: 'text/markdown',
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
    lastSyncedAt: null,
    isDeleted: false,
    syncStatus: 'local',
  },
]

describe('ImageLinkPopover', () => {
  const renderPopover = (props: Partial<Parameters<typeof ImageLinkPopover>[0]> = {}) => {
    return render(
      <DocumentLinkProvider
        currentFileId="doc-current"
        files={mockFiles}
        openDocument={vi.fn()}
      >
        <ImageLinkPopover
          onSave={vi.fn()}
          onClose={vi.fn()}
          {...props}
        />
      </DocumentLinkProvider>
    )
  }

  it('renders popover with Add link title and default recent pages', () => {
    renderPopover()

    expect(screen.getByRole('dialog', { name: 'Add link' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Paste link or search pages')).toBeInTheDocument()
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('Project Roadmap')).toBeInTheDocument()
    expect(screen.getByText('Budget 2026')).toBeInTheDocument()
    expect(screen.getByText('Architecture Notes')).toBeInTheDocument()
  })

  it('filters documents as the user types a query and hides Recent title', () => {
    renderPopover()

    const input = screen.getByPlaceholderText('Paste link or search pages')
    fireEvent.change(input, { target: { value: 'Budget' } })

    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    expect(screen.getByText('Budget 2026')).toBeInTheDocument()
    expect(screen.queryByText('Project Roadmap')).not.toBeInTheDocument()
  })

  it('shows pasted URL as a dropdown item and allows selecting it, then saves on submit', () => {
    const onSave = vi.fn()
    renderPopover({ onSave })

    const input = screen.getByPlaceholderText('Paste link or search pages')
    const testUrl = 'https://example.com/very/long/url/with/lots/of/parameters?param1=value1&param2=value2'
    fireEvent.change(input, { target: { value: testUrl } })

    expect(screen.queryByText('Recent')).not.toBeInTheDocument()
    const urlOption = screen.getByRole('option', { name: testUrl })
    expect(urlOption).toBeInTheDocument()

    // Selecting option updates draft card
    fireEvent.click(urlOption)
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(testUrl)).toBeInTheDocument()

    // Clicking Save saves and closes
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)
    expect(onSave).toHaveBeenCalledWith(testUrl)
  })

  it('confirms pasted URL dropdown item on pressing Enter', () => {
    const onSave = vi.fn()
    renderPopover({ onSave })

    const input = screen.getByPlaceholderText('Paste link or search pages')
    fireEvent.change(input, { target: { value: 'https://github.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith('https://github.com')
  })

  it('updates draft when selecting a document and calls onSave on submit', () => {
    const onSave = vi.fn()
    renderPopover({ onSave })

    const option = screen.getByText('Project Roadmap')
    fireEvent.click(option)

    // Draft card is shown, but onSave is not called yet
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Edit link' })).toBeInTheDocument()

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)
    expect(onSave).toHaveBeenCalledWith('doc:doc-1')
  })

  it('calls onSave with web URL when submitting custom URL form', () => {
    const onSave = vi.fn()
    renderPopover({ onSave })

    const input = screen.getByPlaceholderText('Paste link or search pages')
    fireEvent.change(input, { target: { value: 'https://google.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(onSave).toHaveBeenCalledWith('https://google.com')
  })

  it('shows Edit link title, linked card without Link to prefix, and Unlink button when initialHref is provided', () => {
    const onRemove = vi.fn()
    const onClose = vi.fn()
    renderPopover({ initialHref: 'https://example.com', onRemove, onClose })

    expect(screen.getByRole('dialog', { name: 'Edit link' })).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.queryByText('Link to: https://example.com')).not.toBeInTheDocument()

    const unlinkBtn = screen.getByRole('button', { name: 'Unlink' })
    expect(unlinkBtn).toBeInTheDocument()

    // No separate bottom Remove button
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument()

    fireEvent.click(unlinkBtn)
    // Does not immediately commit onRemove until saved
    expect(onRemove).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    // Click Save commits unlink
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows page name in card when initialHref is an internal doc', () => {
    const onRemove = vi.fn()
    renderPopover({ initialHref: 'doc:doc-1', onRemove })

    expect(screen.getAllByText('Project Roadmap').length).toBeGreaterThanOrEqual(1)
    const unlinkBtn = screen.getByRole('button', { name: 'Unlink' })
    expect(unlinkBtn).toBeInTheDocument()

    fireEvent.click(unlinkBtn)
    expect(onRemove).not.toHaveBeenCalled()

    const saveBtn = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveBtn)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('closes popover without saving when user clicks Cancel or cross icon', () => {
    const onSave = vi.fn()
    const onRemove = vi.fn()
    const onClose = vi.fn()
    const { rerender } = renderPopover({ onSave, onRemove, onClose })

    // Type and select option
    const option = screen.getByText('Project Roadmap')
    fireEvent.click(option)
    expect(onSave).not.toHaveBeenCalled()

    // Click cross icon
    const crossBtn = screen.getByRole('button', { name: /close edit link/i })
    fireEvent.click(crossBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()

    // Rerender with initialHref, unlink then click Cancel
    rerender(
      <DocumentLinkProvider currentFileId="doc-current" files={mockFiles} openDocument={vi.fn()}>
        <ImageLinkPopover initialHref="https://example.com" onSave={onSave} onRemove={onRemove} onClose={onClose} />
      </DocumentLinkProvider>
    )

    const unlinkBtn = screen.getByRole('button', { name: 'Unlink' })
    fireEvent.click(unlinkBtn)
    expect(onRemove).not.toHaveBeenCalled()

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('normalizes internal document URLs to doc:id format on submit', () => {
    const onSave = vi.fn()
    renderPopover({ onSave })

    const input = screen.getByPlaceholderText('Paste link or search pages')
    fireEvent.change(input, { target: { value: 'http://localhost:5173/document/doc-2' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).toHaveBeenCalledWith('doc:doc-2')
  })
})
