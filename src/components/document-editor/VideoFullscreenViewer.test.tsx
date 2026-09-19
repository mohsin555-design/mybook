// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoFullscreenViewer } from './VideoFullscreenViewer'

describe('VideoFullscreenViewer', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders video and bottom controls (Replace, Download, Delete)', () => {
    const handleClose = vi.fn()
    render(
      <VideoFullscreenViewer
        src="https://example.com/demo.mp4"
        alt="Demo Video"
        provider="html5"
        onClose={handleClose}
        onReplace={vi.fn()}
        onDownload={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: /video full screen preview/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /replace video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close full screen/i })).toBeInTheDocument()
  })

  it('handles Replace, Download, and Delete actions', () => {
    const handleClose = vi.fn()
    const handleReplace = vi.fn()
    const handleDownload = vi.fn()
    const handleDelete = vi.fn()

    render(
      <VideoFullscreenViewer
        src="https://example.com/demo.mp4"
        alt="Demo Video"
        provider="html5"
        onClose={handleClose}
        onReplace={handleReplace}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    )

    const replaceBtn = screen.getByRole('button', { name: /replace video/i })
    const downloadBtn = screen.getByRole('button', { name: /download video/i })
    const deleteBtn = screen.getByRole('button', { name: /delete video/i })

    // Clicking replace opens inline picker above controls without closing fullscreen
    fireEvent.click(replaceBtn)
    expect(screen.getByRole('dialog', { name: 'Replace video' })).toBeInTheDocument()
    expect(handleClose).not.toHaveBeenCalled()

    // Submitting replacement triggers onReplace
    const embedTab = screen.getByRole('tab', { name: /embed link/i })
    fireEvent.click(embedTab)
    const urlInput = screen.getByPlaceholderText(/paste video link/i)
    fireEvent.change(urlInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
    const submitBtn = screen.getByRole('button', { name: 'Replace' })
    fireEvent.click(submitBtn)
    expect(handleReplace).toHaveBeenCalledWith('https://www.youtube.com/embed/dQw4w9WgXcQ', 'YouTube video', 'youtube')
    expect(handleClose).not.toHaveBeenCalled()

    fireEvent.click(downloadBtn)
    expect(handleDownload).toHaveBeenCalledTimes(1)

    fireEvent.click(deleteBtn)
    expect(handleDelete).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key press', () => {
    const handleClose = vi.fn()
    render(
      <VideoFullscreenViewer
        src="https://example.com/demo.mp4"
        alt="Demo Video"
        provider="html5"
        onClose={handleClose}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
