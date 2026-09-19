// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'

import { VideoBlockNodeView } from './VideoBlockNodeView'

describe('VideoBlockNodeView', () => {
  let mockEditor: unknown
  let mockNode: {
    attrs: {
      src: string
      alt: string
      width: string
      align: string
      caption: string
      showCaption: boolean
      href?: string | null
      provider?: 'html5' | 'youtube' | 'vimeo' | 'embed'
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
        })),
      })),
    }

    mockNode = {
      attrs: {
        src: 'https://example.com/demo.mp4',
        alt: 'Demo Video',
        width: '100%',
        align: 'left',
        caption: '',
        showCaption: true,
        href: null,
        provider: 'html5',
      },
      nodeSize: 1,
      toJSON: () => ({
        type: 'videoBlock',
        attrs: mockNode.attrs,
      }),
    }

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
        write: vi.fn().mockResolvedValue(undefined),
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

  it('renders video, resize handles, and primary toolbar actions (Replace, Fullscreen, Copy, Align, More)', () => {
    render(<VideoBlockNodeView {...createProps()} />)

    // Check resize handles
    expect(screen.getByRole('slider', { name: /resize top left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize top right/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize bottom right/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize bottom left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize right/i })).toBeInTheDocument()

    // Primary Action toolbar buttons
    expect(screen.getByRole('button', { name: /replace video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /full screen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy block/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /align video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more video options/i })).toBeInTheDocument()
  })

  it('handles video alignment selection (Left, Center, Right)', () => {
    render(<VideoBlockNodeView {...createProps()} />)

    const alignBtn = screen.getByRole('button', { name: /align video/i })
    fireEvent.click(alignBtn)

    const centerOption = screen.getByText('Center')
    fireEvent.click(centerOption)
    expect(updateAttributes).toHaveBeenCalledWith({ align: 'center' })
  })

  it('handles More dropdown actions: Duplicate and Delete', () => {
    render(<VideoBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: /more video options/i })
    fireEvent.click(moreBtn)

    // Duplicate action
    const duplicateOption = screen.getByText('Duplicate')
    fireEvent.click(duplicateOption)
    expect((mockEditor as { chain: unknown }).chain).toHaveBeenCalled()

    // Reopen More and click Delete
    fireEvent.click(moreBtn)
    const deleteOption = screen.getByText('Delete')
    fireEvent.click(deleteOption)
    expect(deleteNode).toHaveBeenCalledTimes(1)
  })

  it('opens the existing video player in native fullscreen without resetting playback', async () => {
    render(<VideoBlockNodeView {...createProps()} />)

    const video = screen.getByLabelText('Demo Video') as HTMLVideoElement
    video.currentTime = 35
    video.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('button', { name: /full screen/i }))
    expect(video.requestFullscreen).toHaveBeenCalledOnce()
    expect(video.currentTime).toBe(35)
    expect(screen.queryByRole('dialog')).toBeNull()
    await Promise.resolve()
  })

  it('handles opening replace popover from top-right toolbar anchor', () => {
    render(<VideoBlockNodeView {...createProps()} />)

    const replaceBtn = screen.getByRole('button', { name: /replace video/i })
    fireEvent.click(replaceBtn)
    expect(screen.getByRole('tab', { name: /upload/i })).toBeInTheDocument()
  })

  it('handles caption workflow: adding, left-aligned input, showing/hiding, and removing', () => {
    const { rerender } = render(<VideoBlockNodeView {...createProps()} />)

    // Open More and click Add caption
    const moreBtn = screen.getByRole('button', { name: /more video options/i })
    fireEvent.click(moreBtn)

    const addCaptionOption = screen.getByText('Add caption')
    fireEvent.click(addCaptionOption)
    expect(updateAttributes).toHaveBeenCalledWith({ showCaption: true })

    // Now render with a caption attribute
    const nodeWithCaption = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        caption: 'Video 1: Product walkthrough',
        showCaption: true,
      },
    }

    rerender(<VideoBlockNodeView {...createProps(nodeWithCaption)} />)

    const captionInput = screen.getByPlaceholderText('Write a caption')
    expect(captionInput).toHaveValue('Video 1: Product walkthrough')
    expect(captionInput).toHaveClass('text-left')

    // Open More and check Remove caption with visibility toggle
    fireEvent.click(moreBtn)
    expect(screen.getByText('Remove caption')).toBeInTheDocument()

    const hideCaptionBtn = screen.getByRole('button', { name: /hide caption/i })
    fireEvent.click(hideCaptionBtn)
    expect(updateAttributes).toHaveBeenCalledWith({ showCaption: false })

    const removeCaptionOption = screen.getByText('Remove caption')
    fireEvent.click(removeCaptionOption)
    expect(updateAttributes).toHaveBeenCalledWith({ caption: '', showCaption: false })
  })

  it('renders iframe for YouTube embeds and expands the same player', async () => {
    const youtubeNode = {
      ...mockNode,
      attrs: {
        ...mockNode.attrs,
        src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        provider: 'youtube' as const,
      },
    }

    render(<VideoBlockNodeView {...createProps(youtubeNode)} />)

    const iframe = screen.getByTitle(/demo video/i)
    expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ')
    iframe.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(iframe.requestFullscreen).toHaveBeenCalledOnce()
    expect(screen.getByTitle(/demo video/i)).toBe(iframe)
    await Promise.resolve()
  })
  it('clears the edit-link field and preserves a resized video when saving a fresh YouTube URL', () => {
    mockNode.attrs.width = '65%'
    mockNode.attrs.align = 'center'
    mockNode.attrs.provider = 'youtube'
    mockNode.attrs.src = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    updateAttributes = vi.fn((attributes) => Object.assign(mockNode.attrs, attributes))
    const { rerender } = render(<VideoBlockNodeView {...createProps()} />)

    fireEvent.click(screen.getByRole('button', { name: /more video options/i }))
    fireEvent.click(screen.getByText('Edit link'))
    const input = screen.getByRole('textbox', { name: 'Video URL' })
    fireEvent.click(screen.getByRole('button', { name: 'Clear URL' }))
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(updateAttributes).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'https://youtu.be/abcdefghijk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    rerender(<VideoBlockNodeView {...createProps()} />)

    const iframe = screen.getByTitle('Demo Video')
    expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/abcdefghijk')
    expect(iframe.parentElement?.parentElement).toHaveStyle({ width: '65%' })
    expect(mockNode.attrs.align).toBe('center')
    expect(screen.queryByRole('dialog', { name: 'Edit video link' })).not.toBeInTheDocument()
  })

  it('uses full width for videos previously inserted with a provider as their width', () => {
    mockNode.attrs.width = 'youtube'
    mockNode.attrs.provider = 'youtube'
    render(<VideoBlockNodeView {...createProps()} />)
    expect(screen.getByTitle('Demo Video').parentElement?.parentElement).toHaveStyle({ width: '100%' })
  })

})
