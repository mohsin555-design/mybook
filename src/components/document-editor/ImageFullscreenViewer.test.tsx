// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImageFullscreenViewer } from './ImageFullscreenViewer'

describe('ImageFullscreenViewer', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders image, caption, and zoom controls', () => {
    const handleClose = vi.fn()
    render(
      <ImageFullscreenViewer
        src="https://example.com/photo.jpg"
        alt="Mountain landscape"
        caption="A beautiful mountain view"
        onClose={handleClose}
      />
    )

    expect(screen.getByRole('dialog', { name: /image full screen preview/i })).toBeInTheDocument()
    const img = screen.getByRole('img', { name: /mountain landscape/i })
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
    expect(screen.getAllByText('A beautiful mountain view').length).toBeGreaterThan(0)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('handles zoom in, zoom out, and reset zoom', () => {
    const handleClose = vi.fn()
    render(
      <ImageFullscreenViewer
        src="https://example.com/photo.jpg"
        alt="Photo"
        onClose={handleClose}
      />
    )

    const zoomInBtn = screen.getByRole('button', { name: /zoom in/i })
    const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i })
    const resetBtn = screen.getByRole('button', { name: /reset zoom/i })

    // Zoom in
    fireEvent.click(zoomInBtn)
    expect(screen.getByText('125%')).toBeInTheDocument()

    fireEvent.click(zoomInBtn)
    expect(screen.getByText('150%')).toBeInTheDocument()

    // Zoom out
    fireEvent.click(zoomOutBtn)
    expect(screen.getByText('125%')).toBeInTheDocument()

    // Reset
    fireEvent.click(resetBtn)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('handles Replace, Download, and Delete actions after Reset zoom', () => {
    const handleClose = vi.fn()
    const handleReplace = vi.fn()
    const handleDownload = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ImageFullscreenViewer
        src="https://example.com/photo.jpg"
        alt="Photo"
        onClose={handleClose}
        onReplace={handleReplace}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    )

    const replaceBtn = screen.getByRole('button', { name: /replace image/i })
    const downloadBtn = screen.getByRole('button', { name: /download image/i })
    const deleteBtn = screen.getByRole('button', { name: /delete image/i })

    // Clicking replace opens inline picker above controls without closing fullscreen
    fireEvent.click(replaceBtn)
    expect(screen.getByRole('dialog', { name: 'Replace image' })).toBeInTheDocument()
    expect(handleClose).not.toHaveBeenCalled()

    // Submitting replacement triggers onReplace
    const embedTab = screen.getByRole('tab', { name: /embed link/i })
    fireEvent.click(embedTab)
    const urlInput = screen.getByPlaceholderText(/paste image link/i)
    fireEvent.change(urlInput, { target: { value: 'https://example.com/new.jpg' } })
    const submitBtn = screen.getByRole('button', { name: 'Replace' })
    fireEvent.click(submitBtn)
    expect(handleReplace).toHaveBeenCalledWith('https://example.com/new.jpg', 'new')
    expect(handleClose).not.toHaveBeenCalled()

    fireEvent.click(downloadBtn)
    expect(handleDownload).toHaveBeenCalledTimes(1)

    fireEvent.click(deleteBtn)
    expect(handleDelete).toHaveBeenCalledTimes(1)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('handles keyboard shortcuts (Escape, +, -, 0)', () => {
    const handleClose = vi.fn()
    render(
      <ImageFullscreenViewer
        src="https://example.com/photo.jpg"
        alt="Photo"
        onClose={handleClose}
      />
    )

    // Zoom in with +
    fireEvent.keyDown(window, { key: '+' })
    expect(screen.getByText('125%')).toBeInTheDocument()

    // Zoom out with -
    fireEvent.keyDown(window, { key: '-' })
    expect(screen.getByText('100%')).toBeInTheDocument()

    // Reset with 0
    fireEvent.keyDown(window, { key: '+' })
    expect(screen.getByText('125%')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: '0' })
    expect(screen.getByText('100%')).toBeInTheDocument()

    // Close with Escape
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('closes when close button or backdrop is clicked', () => {
    const handleClose = vi.fn()
    render(
      <ImageFullscreenViewer
        src="https://example.com/photo.jpg"
        alt="Photo"
        onClose={handleClose}
      />
    )

    const closeBtn = screen.getByRole('button', { name: /close full screen/i })
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)

    const dialog = screen.getByRole('dialog', { name: /image full screen preview/i })
    fireEvent.click(dialog)
    expect(handleClose).toHaveBeenCalledTimes(2)
  })
})
