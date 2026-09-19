// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MyBookFile } from '../../types/files'
import { DocumentLinkProvider } from './DocumentLinkContext'
import { DocumentLinkNodeView } from './DocumentLinkNodeView'

function file(id: string, name: string, isDeleted = false): MyBookFile {
  return {
    id,
    driveFileId: null,
    workspaceType: 'local',
    name,
    type: 'document',
    folderId: null,
    content: '',
    mimeType: 'application/x-mybook-document',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
    lastSyncedAt: null,
    syncStatus: 'local',
    isDeleted,
  }
}

function renderLink(attrs: { label: string; targetId: string }, files: MyBookFile[], openDocument = vi.fn()) {
  const editor = {
    commands: { insertContentAt: vi.fn() },
    chain: () => ({ focus: () => ({ deleteRange: () => ({ run: vi.fn() }) }) }),
  }
  render(
    <DocumentLinkProvider currentFileId="doc_a" files={files} openDocument={openDocument}>
      <DocumentLinkNodeView node={{ attrs, nodeSize: 1, toJSON: () => ({ type: 'documentLink', attrs }) } as never} selected={false} editor={editor as never} view={{} as never} getPos={vi.fn(() => 1)} decorations={[]} innerDecorations={{} as never} updateAttributes={vi.fn()} deleteNode={vi.fn()} extension={{} as never} HTMLAttributes={{}} />
    </DocumentLinkProvider>,
  )
  return openDocument
}

describe('DocumentLinkNodeView', () => {
  afterEach(() => cleanup())

  it('resolves the current target title by stable id', () => {
    renderLink({ targetId: 'doc_b', label: 'Old Project Notes' }, [file('doc_b', 'Project Plan')])

    expect(screen.getByRole('button', { name: 'Open page Project Plan' })).toBeInTheDocument()
  })

  it('navigates using target id for duplicate titles', () => {
    const openDocument = renderLink({ targetId: 'doc_b', label: 'Project Notes' }, [
      file('doc_a', 'Project Notes'),
      file('doc_b', 'Project Notes'),
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open page Project Notes' }))
    expect(openDocument).toHaveBeenCalledWith('doc_b')
  })

  it('shows unavailable fallback for missing or trashed targets', () => {
    renderLink({ targetId: 'doc_missing', label: 'Project Notes' }, [file('doc_missing', 'Project Notes', true)])

    expect(screen.getByRole('button', { name: 'Project Notes unavailable' })).toBeDisabled()
    expect(screen.getByText(/unavailable/iu)).toBeInTheDocument()
  })

  it('renders top-right action toolbar with Copy block, Duplicate, and Delete buttons', () => {
    renderLink({ targetId: 'doc_b', label: 'Project Notes' }, [file('doc_b', 'Project Notes')])

    expect(screen.getByRole('button', { name: 'Copy block' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('displays Document as secondary description text for documents', () => {
    renderLink({ targetId: 'doc_b', label: 'Project Notes' }, [file('doc_b', 'Project Notes')])

    expect(screen.getByText('Project Notes')).toHaveClass('mybook-mention-name')
    expect(screen.getByText('Document')).toHaveClass('mybook-mention-title')
  })

  it('displays Spreadsheet as secondary description text for spreadsheets', () => {
    const sheetFile: MyBookFile = {
      ...file('sheet_1', 'Budget 2026'),
      type: 'spreadsheet',
    }
    renderLink({ targetId: 'sheet_1', label: 'Budget 2026' }, [sheetFile])

    expect(screen.getByText('Budget 2026')).toHaveClass('mybook-mention-name')
    expect(screen.getByText('Spreadsheet')).toHaveClass('mybook-mention-title')
  })

  it('triggers duplicate when Duplicate action is clicked', () => {
    const insertContentAt = vi.fn()
    const editor = {
      commands: { insertContentAt },
      chain: () => ({ focus: () => ({ deleteRange: () => ({ run: vi.fn() }) }) }),
    }
    render(
      <DocumentLinkProvider currentFileId="doc_a" files={[file('doc_b', 'Project Notes')]} openDocument={vi.fn()}>
        <DocumentLinkNodeView
          node={{ attrs: { targetId: 'doc_b', label: 'Project Notes' }, nodeSize: 1, toJSON: () => ({ type: 'documentLink' }) } as never}
          selected={false}
          editor={editor as never}
          view={{} as never}
          getPos={vi.fn(() => 5)}
          decorations={[]}
          innerDecorations={{} as never}
          updateAttributes={vi.fn()}
          deleteNode={vi.fn()}
          extension={{} as never}
          HTMLAttributes={{}}
        />
      </DocumentLinkProvider>,
    )

    const duplicateBtn = screen.getByRole('button', { name: 'Duplicate' })
    fireEvent.click(duplicateBtn)

    expect(insertContentAt).toHaveBeenCalledWith(6, { type: 'documentLink' })
  })

  it('triggers deleteNode when Delete action is clicked', () => {
    const deleteNode = vi.fn()
    render(
      <DocumentLinkProvider currentFileId="doc_a" files={[file('doc_b', 'Project Notes')]} openDocument={vi.fn()}>
        <DocumentLinkNodeView
          node={{ attrs: { targetId: 'doc_b', label: 'Project Notes' }, nodeSize: 1, toJSON: () => ({ type: 'documentLink' }) } as never}
          selected={false}
          editor={{ commands: { insertContentAt: vi.fn() } } as never}
          view={{} as never}
          getPos={vi.fn(() => 5)}
          decorations={[]}
          innerDecorations={{} as never}
          updateAttributes={vi.fn()}
          deleteNode={deleteNode}
          extension={{} as never}
          HTMLAttributes={{}}
        />
      </DocumentLinkProvider>,
    )

    const deleteBtn = screen.getByRole('button', { name: 'Delete' })
    fireEvent.click(deleteBtn)

    expect(deleteNode).toHaveBeenCalledTimes(1)
  })
})
