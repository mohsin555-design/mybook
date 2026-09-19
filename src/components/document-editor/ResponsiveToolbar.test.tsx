// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ImageBlockNodeView } from './ImageBlockNodeView'
import { VideoBlockNodeView } from './VideoBlockNodeView'
import { AudioBlockNodeView } from './AudioBlockNodeView'
import { FileBlockNodeView } from './FileBlockNodeView'
import { DocumentLinkNodeView } from './DocumentLinkNodeView'
import { DocumentLinkProvider } from './DocumentLinkContext'
import type { MyBookFile } from '../../types/files'

vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  NodeViewContent: ({ className }: { className?: string }) => <div className={className} />,
}))

vi.mock('./imageClipboard', () => ({
  copyImageToClipboard: vi.fn().mockResolvedValue(true),
}))

vi.mock('./fileClipboard', () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
  parseFileUrl: vi.fn((url: string) => ({ src: url, name: 'parsed-file.pdf', size: 1024, mimeType: 'application/pdf' })),
}))

function mockEditor() {
  const insertContentAt = vi.fn()
  const focus = vi.fn(() => ({
    deleteRange: vi.fn(() => ({ run: vi.fn() })),
    insertContentAt: vi.fn(() => ({ run: vi.fn() })),
  }))
  return {
    chain: () => ({ focus }),
    commands: { insertContentAt },
    view: { focus: vi.fn() },
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Responsive Toolbar & Bottom Sheet Behavior', () => {
  it('renders ImageBlock toolbar with desktop-only inline actions and More button', () => {
    const editor = mockEditor()
    const updateAttributes = vi.fn()
    const deleteNode = vi.fn()
    const node = {
      attrs: { src: 'https://example.com/test.jpg', alt: 'Test image', align: 'center' },
      nodeSize: 1,
      toJSON: () => ({ type: 'imageBlock', attrs: { src: 'https://example.com/test.jpg' } }),
    }

    const { container } = render(
      <ImageBlockNodeView
        node={node as never}
        editor={editor as never}
        getPos={() => 1}
        updateAttributes={updateAttributes}
        deleteNode={deleteNode}
        selected={false}
        view={{} as never}
        decorations={[]}
        innerDecorations={{} as never}
        extension={{} as never}
        HTMLAttributes={{}}
      />,
    )

    // Check that inline action buttons have desktop-only wrapper class
    const desktopWrappers = container.querySelectorAll('.mybook-desktop-only-action')
    expect(desktopWrappers.length).toBeGreaterThanOrEqual(4)

    // Check More button exists
    const moreBtn = screen.getByRole('button', { name: 'More image options' })
    expect(moreBtn).toBeInTheDocument()

    // Clicking More reveals dropdown menu with standard items
    fireEvent.click(moreBtn)
    expect(screen.getByRole('menuitem', { name: /download/iu })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /delete/iu })).toBeInTheDocument()
  })

  it('renders VideoBlock toolbar with desktop-only actions and More button', () => {
    const editor = mockEditor()
    const updateAttributes = vi.fn()
    const deleteNode = vi.fn()
    const node = {
      attrs: { src: 'https://example.com/test.mp4', title: 'Test Video', align: 'center' },
      nodeSize: 1,
      toJSON: () => ({ type: 'videoBlock', attrs: { src: 'https://example.com/test.mp4' } }),
    }

    const { container } = render(
      <VideoBlockNodeView
        node={node as never}
        editor={editor as never}
        getPos={() => 1}
        updateAttributes={updateAttributes}
        deleteNode={deleteNode}
        selected={false}
        view={{} as never}
        decorations={[]}
        innerDecorations={{} as never}
        extension={{} as never}
        HTMLAttributes={{}}
      />,
    )

    const desktopWrappers = container.querySelectorAll('.mybook-desktop-only-action')
    expect(desktopWrappers.length).toBeGreaterThanOrEqual(3)

    const moreBtn = screen.getByRole('button', { name: 'More video options' })
    expect(moreBtn).toBeInTheDocument()
  })

  it('renders AudioBlock toolbar with desktop-only actions and More button', () => {
    const editor = mockEditor()
    const updateAttributes = vi.fn()
    const deleteNode = vi.fn()
    const node = {
      attrs: { src: 'https://example.com/test.mp3', title: 'Test Audio', align: 'center' },
      nodeSize: 1,
      toJSON: () => ({ type: 'audioBlock', attrs: { src: 'https://example.com/test.mp3' } }),
    }

    const { container } = render(
      <AudioBlockNodeView
        node={node as never}
        editor={editor as never}
        getPos={() => 1}
        updateAttributes={updateAttributes}
        deleteNode={deleteNode}
        selected={false}
        view={{} as never}
        decorations={[]}
        innerDecorations={{} as never}
        extension={{} as never}
        HTMLAttributes={{}}
      />,
    )

    const desktopWrappers = container.querySelectorAll('.mybook-desktop-only-action')
    expect(desktopWrappers.length).toBeGreaterThanOrEqual(3)

    const moreBtn = screen.getByRole('button', { name: 'More audio options' })
    expect(moreBtn).toBeInTheDocument()
  })

  it('renders FileBlock toolbar with desktop-only actions and More button', () => {
    const editor = mockEditor()
    const updateAttributes = vi.fn()
    const deleteNode = vi.fn()
    const node = {
      attrs: { src: 'https://example.com/test.pdf', name: 'document.pdf', size: 2048, mimeType: 'application/pdf' },
      nodeSize: 1,
      toJSON: () => ({ type: 'fileBlock', attrs: { src: 'https://example.com/test.pdf' } }),
    }

    const { container } = render(
      <FileBlockNodeView
        node={node as never}
        editor={editor as never}
        getPos={() => 1}
        updateAttributes={updateAttributes}
        deleteNode={deleteNode}
        selected={false}
        view={{} as never}
        decorations={[]}
        innerDecorations={{} as never}
        extension={{} as never}
        HTMLAttributes={{}}
      />,
    )

    const desktopWrappers = container.querySelectorAll('.mybook-desktop-only-action')
    expect(desktopWrappers.length).toBeGreaterThanOrEqual(3)

    const moreBtn = screen.getByRole('button', { name: 'More file options' })
    expect(moreBtn).toBeInTheDocument()
  })

  it('renders DocumentLink toolbar with desktop actions and mobile More button', () => {
    const editor = mockEditor()
    const file: MyBookFile = {
      id: 'doc_1',
      driveFileId: null,
      workspaceType: 'local',
      name: 'Meeting Notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: false,
    }

    const node = {
      attrs: { targetId: 'doc_1', label: 'Meeting Notes' },
      nodeSize: 1,
      toJSON: () => ({ type: 'documentLink', attrs: { targetId: 'doc_1' } }),
    }

    const { container } = render(
      <DocumentLinkProvider currentFileId="doc_root" files={[file]} openDocument={vi.fn()}>
        <DocumentLinkNodeView
          node={node as never}
          editor={editor as never}
          getPos={() => 1}
          updateAttributes={vi.fn()}
          deleteNode={vi.fn()}
          selected={false}
          view={{} as never}
          decorations={[]}
          innerDecorations={{} as never}
          extension={{} as never}
          HTMLAttributes={{}}
        />
      </DocumentLinkProvider>,
    )

    const desktopWrappers = container.querySelectorAll('.mybook-desktop-only-action')
    expect(desktopWrappers.length).toBe(3)

    const mobileWrappers = container.querySelectorAll('.mybook-mobile-only-action')
    expect(mobileWrappers.length).toBe(1)
  })
})
