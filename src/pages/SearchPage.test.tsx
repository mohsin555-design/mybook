// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchPage } from './SearchPage'
import { fileRepository, folderRepository } from '../database/repositories'
import { toast } from '../components/ui/toast'
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
    delete: vi.fn(),
    duplicate: vi.fn(),
    restore: vi.fn(),
    update: vi.fn(),
  },
  folderRepository: {
    delete: vi.fn(),
    restore: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../components/ui/toast', () => ({
  toast: {
    add: vi.fn(),
  },
}))

vi.mock('../components/files/FileActionsMenu', () => ({
  FileActionsMenu: ({ fileName, onDelete }: { fileName: string; onDelete: () => void }) => (
    <button type="button" onClick={onDelete}>Delete file {fileName}</button>
  ),
}))

vi.mock('../components/files/FolderActionsMenu', () => ({
  FolderActionsMenu: ({ folderName, onDelete }: { folderName: string; onDelete: () => void }) => (
    <button type="button" onClick={onDelete}>Delete folder {folderName}</button>
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
  vi.mocked(fileRepository.delete).mockResolvedValue({ success: true })
  vi.mocked(folderRepository.delete).mockResolvedValue({ success: true })
})

afterEach(() => {
  cleanup()
})

describe('SearchPage', () => {
  it('searches folders and navigates to matching folders', () => {
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: null,
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      isDeleted: false,
    }]

    render(<MemoryRouter><SearchPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Search files and folders'), { target: { value: 'proj' } })
    fireEvent.click(screen.getByRole('button', { name: /ProjectsEmpty/ }))

    expect(mockNavigate).toHaveBeenCalledWith('/folders/folder-1')
  })

  it('shows same-name file and folder results with distinct rows', () => {
    mockLibraryData.files = [{
      id: 'file-1',
      driveFileId: null,
      name: 'A folder',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    }]
    mockLibraryData.folders = [
      {
        id: 'folder-1',
        driveFolderId: null,
        name: 'A folder',
        parentId: null,
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:01:00.000Z',
        isDeleted: false,
      },
      {
        id: 'folder-child',
        driveFolderId: null,
        name: 'Child',
        parentId: 'folder-1',
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
        isDeleted: false,
      },
    ]

    render(<MemoryRouter><SearchPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Search files and folders'), { target: { value: 'a folder' } })

    expect(screen.getAllByText('A folder')).toHaveLength(2)
    expect(screen.getByText('1 folder')).toBeInTheDocument()
    expect(screen.getByText('Updated Aug 22, 2026, 12:00 AM')).toBeInTheDocument()
  })

  it('shows a global empty state when no files or folders match', () => {
    render(<MemoryRouter><SearchPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Search files and folders'), { target: { value: 'missing' } })

    expect(screen.getByText('No files or folders found')).toBeInTheDocument()
    expect(screen.getByText('Try another name.')).toBeInTheDocument()
  })

  it('requires confirmation before deleting search results', async () => {
    mockLibraryData.files = [{
      id: 'file-1',
      driveFileId: null,
      name: 'Archive note',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    }]
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: null,
      name: 'Archive',
      parentId: null,
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
      isDeleted: false,
    }]

    render(<MemoryRouter><SearchPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Search files and folders'), { target: { value: 'archive' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete file Archive note' }))

    expect(fileRepository.delete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Move "Archive note" to Trash?')
    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }))

    await waitFor(() => expect(fileRepository.delete).toHaveBeenCalledWith('file-1'))
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({
      title: '"Archive note" deleted',
      type: 'success',
      priority: 'low',
    }))

    let toastArg = vi.mocked(toast.add).mock.calls.at(-1)?.[0]
    toastArg?.actionProps?.onClick?.({} as MouseEvent<HTMLButtonElement>)
    expect(fileRepository.restore).toHaveBeenCalledWith('file-1')

    fireEvent.click(screen.getByRole('button', { name: 'Delete folder Archive' }))

    expect(folderRepository.delete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Move "Archive" to Trash?')
    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }))

    await waitFor(() => expect(folderRepository.delete).toHaveBeenCalledWith('folder-1'))
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({
      title: '"Archive" deleted',
      type: 'success',
      priority: 'low',
    }))

    toastArg = vi.mocked(toast.add).mock.calls.at(-1)?.[0]
    toastArg?.actionProps?.onClick?.({} as MouseEvent<HTMLButtonElement>)
    expect(folderRepository.restore).toHaveBeenCalledWith('folder-1')
  })
})
