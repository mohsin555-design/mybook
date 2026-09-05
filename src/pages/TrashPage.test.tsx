// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { TrashPage } from './TrashPage'
import { fileRepository, folderRepository } from '../database/repositories'
import type { MyBookFile, MyBookFolder } from '../types/files'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockLibraryData = vi.hoisted((): { files: MyBookFile[]; folders: MyBookFolder[]; isLoading: boolean } => ({
  files: [],
  folders: [],
  isLoading: false,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../hooks/useLibraryData', () => ({
  useLibraryData: () => mockLibraryData,
}))

vi.mock('../database/repositories', () => ({
  fileRepository: {
    permanentlyDelete: vi.fn(),
    restore: vi.fn(),
  },
  folderRepository: {
    permanentlyDelete: vi.fn(),
    restore: vi.fn(),
  },
}))

vi.mock('../components/files/TrashActionsMenu', () => ({
  TrashActionsMenu: ({ fileName, onRestore, onDelete }: { fileName: string; onRestore: () => void; onDelete: () => void }) => (
    <div>
      <button type="button" onClick={onRestore}>Restore {fileName}</button>
      <button type="button" onClick={onDelete}>Delete permanently {fileName}</button>
    </div>
  ),
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true
  })
  HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false
  })
})

beforeEach(() => {
  mockNavigate.mockClear()
  mockLibraryData.files = []
  mockLibraryData.folders = []
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('TrashPage', () => {
  it('requires confirmation before permanently deleting a file', async () => {
    mockLibraryData.files = [{
      id: 'file-1',
      driveFileId: null,
      name: 'Old notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: true,
    }]

    render(<MemoryRouter><TrashPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently Old notes' }))

    expect(fileRepository.permanentlyDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete "Old notes" permanently?')

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

    await waitFor(() => expect(fileRepository.permanentlyDelete).toHaveBeenCalledWith('file-1'))
  })

  it('shows top-level deleted folders in Trash and restores them by folder ID', async () => {
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: 'drive-folder-1',
      workspaceType: 'drive',
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      isDeleted: true,
    }]

    render(<MemoryRouter><TrashPage /></MemoryRouter>)

    expect(screen.getByText('Projects')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore Projects' }))

    expect(folderRepository.restore).toHaveBeenCalledWith('folder-1')
  })

  it('does not surface descendants of a trashed folder as separate Trash entries', () => {
    mockLibraryData.folders = [
      {
        id: 'folder-parent',
        driveFolderId: null,
        workspaceType: 'local',
        name: 'Projects',
        parentId: null,
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        isDeleted: true,
      },
      {
        id: 'folder-child',
        driveFolderId: null,
        workspaceType: 'local',
        name: 'Assets',
        parentId: 'folder-parent',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        isDeleted: true,
      },
    ]
    mockLibraryData.files = [{
      id: 'file-child',
      driveFileId: null,
      workspaceType: 'local',
      name: 'Budget',
      type: 'document',
      folderId: 'folder-child',
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'local',
      isDeleted: true,
    }]

    render(<MemoryRouter><TrashPage /></MemoryRouter>)

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.queryByText('Assets')).not.toBeInTheDocument()
    expect(screen.queryByText('Budget')).not.toBeInTheDocument()
  })

  it('requires confirmation before permanently deleting a folder', async () => {
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: null,
      workspaceType: 'local',
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      isDeleted: true,
    }]

    render(<MemoryRouter><TrashPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently Projects' }))

    expect(folderRepository.permanentlyDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete "Projects" permanently?')
    expect(screen.getByRole('dialog')).toHaveTextContent('This folder will be permanently deleted')

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

    await waitFor(() => expect(folderRepository.permanentlyDelete).toHaveBeenCalledWith('folder-1'))
  })

  it('counts folders when deciding whether Trash is empty', () => {
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: null,
      workspaceType: 'local',
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      isDeleted: true,
    }]

    render(<MemoryRouter><TrashPage /></MemoryRouter>)

    expect(screen.queryByText('Trash is empty')).not.toBeInTheDocument()
  })
})
