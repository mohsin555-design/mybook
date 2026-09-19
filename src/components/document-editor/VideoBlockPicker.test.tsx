// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VideoBlockPicker } from './VideoBlockPicker'

afterEach(() => {
  cleanup()
})

describe('VideoBlockPicker', () => {
  const defaultPosition = { left: 100, top: 200 }

  it('renders the popover with Upload and Embed link tabs', () => {
    render(
      <VideoBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Add a video' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Upload' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Embed link' })).toBeInTheDocument()
    expect(screen.getByText(/drag & drop a video here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument()
  })

  it('triggers file selection when Browse files is clicked', () => {
    render(
      <VideoBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload video file') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const browseBtn = screen.getByRole('button', { name: /browse files/i })
    fireEvent.click(browseBtn)

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('validates file type and displays error for non-video files', () => {
    render(
      <VideoBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload video file')
    const invalidFile = new File(['text content'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/please choose a video file/i)
  })

  it('validates file size and displays error for files exceeding 50 MB', () => {
    render(
      <VideoBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    const fileInput = screen.getByLabelText('Upload video file')
    // Create a 51MB dummy file
    const oversizedFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'huge.mp4', { type: 'video/mp4' })

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/video is too large/i)
  })

  it('handles valid file upload and triggers onInsert on Add', async () => {
    const onInsert = vi.fn()
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-video-url')
    window.URL.revokeObjectURL = vi.fn()

    render(
      <VideoBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const fileInput = screen.getByLabelText('Upload video file')
    const validFile = new File(['mock video data'], 'demo.mp4', { type: 'video/mp4' })

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByText('demo.mp4')).toBeInTheDocument()
    })

    const addBtn = screen.getByRole('button', { name: 'Add video' })
    fireEvent.click(addBtn)

    await waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith(
        expect.stringContaining('data:video/mp4;base64,'),
        'demo',
        'html5'
      )
    })
  })

  it('embeds YouTube URL correctly via Embed link tab', () => {
    const onInsert = vi.fn()

    render(
      <VideoBlockPicker
        position={defaultPosition}
        onClose={vi.fn()}
        onInsert={onInsert}
      />
    )

    const embedTab = screen.getByRole('tab', { name: 'Embed link' })
    fireEvent.click(embedTab)

    const urlInput = screen.getByPlaceholderText(/paste video link/i)
    fireEvent.change(urlInput, { target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })

    const addBtn = screen.getByRole('button', { name: 'Add video' })
    fireEvent.click(addBtn)

    expect(onInsert).toHaveBeenCalledWith(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'YouTube video',
      'youtube'
    )
  })

  it('renders custom title and submit label when provided', () => {
    render(
      <VideoBlockPicker
        position={defaultPosition}
        title="Replace video"
        submitLabel="Replace"
        initialTab="embed"
        onClose={vi.fn()}
        onInsert={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Replace video' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })
})
