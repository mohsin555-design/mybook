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
  render(
    <DocumentLinkProvider currentFileId="doc_a" files={files} openDocument={openDocument}>
      <DocumentLinkNodeView node={{ attrs } as never} selected={false} editor={{} as never} view={{} as never} getPos={vi.fn()} decorations={[]} innerDecorations={{} as never} updateAttributes={vi.fn()} deleteNode={vi.fn()} extension={{} as never} HTMLAttributes={{}} />
    </DocumentLinkProvider>,
  )
  return openDocument
}

describe('DocumentLinkNodeView', () => {
  afterEach(() => cleanup())

  it('resolves the current target title by stable id', () => {
    renderLink({ targetId: 'doc_b', label: 'Old Project Notes' }, [file('doc_b', 'Project Plan')])

    expect(screen.getByRole('button', { name: 'Open document Project Plan' })).toBeInTheDocument()
  })

  it('navigates using target id for duplicate titles', () => {
    const openDocument = renderLink({ targetId: 'doc_b', label: 'Project Notes' }, [
      file('doc_a', 'Project Notes'),
      file('doc_b', 'Project Notes'),
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open document Project Notes' }))
    expect(openDocument).toHaveBeenCalledWith('doc_b')
  })

  it('shows unavailable fallback for missing or trashed targets', () => {
    renderLink({ targetId: 'doc_missing', label: 'Project Notes' }, [file('doc_missing', 'Project Notes', true)])

    expect(screen.getByRole('button', { name: 'Project Notes unavailable' })).toBeDisabled()
    expect(screen.getByText(/unavailable/iu)).toBeInTheDocument()
  })
})
