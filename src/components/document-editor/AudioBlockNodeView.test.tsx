// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NodeViewProps } from '@tiptap/react'

import { AudioBlockNodeView } from './AudioBlockNodeView'

describe('AudioBlockNodeView', () => {
  let mockEditor: unknown
  let mockNode: {
    attrs: {
      src: string
      title: string
      width: string
      align: string
      artwork: string
      caption: string
      showCaption: boolean
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
        src: 'https://example.com/podcast.mp3',
        title: 'Episode 1 - Introduction',
        width: '100%',
        align: 'left',
        artwork: '',
        caption: '',
        showCaption: true,
      },
      nodeSize: 1,
      toJSON: () => ({
        type: 'audioBlock',
        attrs: mockNode.attrs,
      }),
    }

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })

    // Mock HTMLMediaElement methods
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.pause = vi.fn()
    window.HTMLMediaElement.prototype.load = vi.fn()
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

  it('renders audio card with title, play/pause button, time display, seek bar, volume control, and toolbar actions', () => {
    render(<AudioBlockNodeView {...createProps()} />)

    // Audio Card details
    expect(screen.getByText('Episode 1 - Introduction')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play audio/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /seek time/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rewind 10 seconds/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fast forward 10 seconds/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mute/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /^volume$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /playback speed/i })).toBeInTheDocument()

    // Primary Action toolbar buttons (Replace, Copy, Align, Duplicate, More)
    expect(screen.getByRole('button', { name: /replace audio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy block/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /align audio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate audio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more audio options/i })).toBeInTheDocument()

    // Resize handles
    expect(screen.getByRole('slider', { name: /resize top left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize top right/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize bottom right/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize bottom left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize left/i })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /resize right/i })).toBeInTheDocument()
  })

  it('toggles play/pause state when play button is clicked', () => {
    render(<AudioBlockNodeView {...createProps()} />)

    const playBtn = screen.getByRole('button', { name: /play audio/i })
    fireEvent.click(playBtn)

    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })

  it('handles volume changes and mute toggling', () => {
    render(<AudioBlockNodeView {...createProps()} />)

    const volumeSlider = screen.getByRole('slider', { name: /^volume$/i })
    fireEvent.change(volumeSlider, { target: { value: '0.5' } })
    expect(volumeSlider).toHaveValue('0.5')

    const muteBtn = screen.getByRole('button', { name: /mute/i })
    fireEvent.click(muteBtn)
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument()
  })

  it('handles audio alignment selection (Left, Center, Right)', () => {
    render(<AudioBlockNodeView {...createProps()} />)

    const alignBtn = screen.getByRole('button', { name: /align audio/i })
    fireEvent.click(alignBtn)

    const centerOption = screen.getByRole('menuitem', { name: /center/i })
    fireEvent.click(centerOption)

    expect(updateAttributes).toHaveBeenCalledWith({ align: 'center' })
  })

  it('handles duplicate toolbar button and delete in More menu', () => {
    render(<AudioBlockNodeView {...createProps()} />)

    const duplicateBtn = screen.getByRole('button', { name: /duplicate audio/i })
    fireEvent.click(duplicateBtn)
    expect((mockEditor as { chain: unknown }).chain).toHaveBeenCalled()

    const moreBtn = screen.getByRole('button', { name: /more audio options/i })
    fireEvent.click(moreBtn)
    const deleteOption = screen.getByRole('menuitem', { name: /delete/i })
    fireEvent.click(deleteOption)

    expect(deleteNode).toHaveBeenCalled()
  })

  it('handles URL-specific items in More menu (Open, Edit link, Copy link)', () => {
    render(<AudioBlockNodeView {...createProps()} />)

    const moreBtn = screen.getByRole('button', { name: /more audio options/i })
    fireEvent.click(moreBtn)

    expect(screen.getByRole('menuitem', { name: /^open$/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /download/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /edit link/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /add caption/i })).toBeInTheDocument()
  })

  it('changes playback speed when a speed option is selected', () => {
    render(<AudioBlockNodeView {...createProps()} />)

    const speedBtn = screen.getByRole('button', { name: /playback speed/i })
    fireEvent.click(speedBtn)

    const speed15x = screen.getByRole('menuitem', { name: /1\.5x/i })
    fireEvent.click(speed15x)

    expect(screen.getByRole('button', { name: /playback speed/i })).toHaveTextContent('1.5x')
  })

  it('opens replace audio popover and handles replacing audio', () => {
    render(<AudioBlockNodeView {...createProps()} />)

    const replaceBtn = screen.getByRole('button', { name: /replace audio/i })
    fireEvent.click(replaceBtn)

    expect(screen.getByRole('dialog', { name: /replace audio/i })).toBeInTheDocument()

    const embedTab = screen.getByRole('tab', { name: /embed link/i })
    fireEvent.click(embedTab)

    const input = screen.getByPlaceholderText(/paste audio link/i)
    fireEvent.change(input, { target: { value: 'https://example.com/new-track.mp3' } })

    const saveBtn = screen.getByRole('button', { name: /^replace$/i })
    fireEvent.click(saveBtn)

    expect(updateAttributes).toHaveBeenCalledWith({
      src: 'https://example.com/new-track.mp3',
      title: 'new-track',
    })
  })
})

