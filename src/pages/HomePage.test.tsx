// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { HomePage } from './HomePage'
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
    create: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
    restore: vi.fn(),
    setFavorite: vi.fn(),
    update: vi.fn(),
  },
  folderRepository: {
    create: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    setFavorite: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../components/ui/toast', () => ({
  toast: {
    add: vi.fn(),
  },
}))

vi.mock('../components/files/CreateItemDrawer', () => ({
  CreateItemDrawer: ({ onCreateFolder }: { onCreateFolder: () => void }) => (
    <button type="button" onClick={onCreateFolder}>New folder</button>
  ),
}))

vi.mock('../components/files/FileActionsMenu', () => ({
  FileActionsMenu: ({
    fileName,
    isFavorite,
    onDelete,
    onToggleFavorite,
  }: {
    fileName: string
    isFavorite?: boolean
    onDelete: () => void
    onToggleFavorite?: () => void
  }) => (
    <div>
      {onToggleFavorite ? (
        <button type="button" onClick={onToggleFavorite}>
          {isFavorite ? 'Remove from favorites' : 'Add to favorites'} file {fileName}
        </button>
      ) : null}
      <button type="button" onClick={onDelete}>Delete file {fileName}</button>
    </div>
  ),
}))

vi.mock('../components/files/FolderActionsMenu', () => ({
  FolderActionsMenu: ({
    folderName,
    isFavorite,
    onDelete,
    onToggleFavorite,
  }: {
    folderName: string
    isFavorite?: boolean
    onDelete: () => void
    onToggleFavorite?: () => void
  }) => (
    <div>
      {onToggleFavorite ? (
        <button type="button" onClick={onToggleFavorite}>
          {isFavorite ? 'Remove from favorites' : 'Add to favorites'} folder {folderName}
        </button>
      ) : null}
      <button type="button" onClick={onDelete}>Delete folder {folderName}</button>
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

afterEach(() => {
  cleanup()
})

describe('HomePage folder creation', () => {
  beforeEach(() => {
    mockLibraryData.files = []
    mockLibraryData.folders = []
    mockNavigate.mockClear()
    vi.clearAllMocks()
    vi.mocked(fileRepository.delete).mockResolvedValue({ success: true })
    vi.mocked(folderRepository.delete).mockResolvedValue({ success: true })
    vi.mocked(fileRepository.setFavorite).mockResolvedValue({ success: true })
    vi.mocked(folderRepository.setFavorite).mockResolvedValue({ success: true })
  })

  it('closes the dialog, navigates into the new folder, and shows a success toast', async () => {
    vi.mocked(folderRepository.create).mockResolvedValue({
      success: true,
      data: {
        id: 'folder-1',
        driveFolderId: null,
        name: 'Projects',
        parentId: null,
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
        isDeleted: false,
      },
    })

    render(<MemoryRouter><HomePage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'New folder' }))
    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'Projects' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/folders/folder-1'))
    expect(toast.add).toHaveBeenCalledWith({
      title: '"Projects" created',
      type: 'success',
      priority: 'low',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('uses Recent-specific empty copy when there are no recent files', () => {
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: null,
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      isDeleted: false,
    }]

    render(<MemoryRouter><HomePage /></MemoryRouter>)

    expect(screen.getByText('No recent files')).toBeInTheDocument()
    expect(screen.getByText('Files you open or edit will appear here.')).toBeInTheDocument()
    expect(screen.queryByText('No files yet')).not.toBeInTheDocument()
  })

  it('requires confirmation before deleting a recent file', async () => {
    mockLibraryData.files = [{
      id: 'file-1',
      driveFileId: null,
      name: 'Notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    }]

    render(<MemoryRouter><HomePage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Delete file Notes' }))

    expect(fileRepository.delete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Move "Notes" to Trash?')

    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }))

    await waitFor(() => expect(fileRepository.delete).toHaveBeenCalledWith('file-1'))
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({
      title: '"Notes" deleted',
      type: 'success',
      priority: 'low',
    }))

    const toastArg = vi.mocked(toast.add).mock.calls.at(-1)?.[0]
    toastArg?.actionProps?.onClick?.({} as MouseEvent<HTMLButtonElement>)
    expect(fileRepository.restore).toHaveBeenCalledWith('file-1')
  })

  it('shows favorite files and folders while hiding non-favorites and deleted favorites', () => {
    mockLibraryData.files = [
      {
        id: 'file-favorite',
        driveFileId: null,
        name: 'Favorite Notes',
        type: 'document',
        folderId: null,
        content: '',
        mimeType: 'application/x-mybook-document',
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
        lastSyncedAt: null,
        syncStatus: 'pending',
        isDeleted: false,
        isFavorite: true,
      },
      {
        id: 'file-normal',
        driveFileId: null,
        name: 'Normal Notes',
        type: 'document',
        folderId: null,
        content: '',
        mimeType: 'application/x-mybook-document',
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
        lastSyncedAt: null,
        syncStatus: 'pending',
        isDeleted: false,
      },
      {
        id: 'file-deleted',
        driveFileId: null,
        name: 'Deleted Favorite',
        type: 'document',
        folderId: null,
        content: '',
        mimeType: 'application/x-mybook-document',
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        lastSyncedAt: null,
        syncStatus: 'pending',
        isDeleted: true,
        isFavorite: true,
      },
    ]
    mockLibraryData.folders = [
      {
        id: 'folder-favorite',
        driveFolderId: null,
        name: 'Favorite Folder',
        parentId: null,
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-09-02T00:00:00.000Z',
        isDeleted: false,
        isFavorite: true,
      },
      {
        id: 'folder-normal',
        driveFolderId: null,
        name: 'Normal Folder',
        parentId: null,
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
        isDeleted: false,
      },
    ]

    render(<MemoryRouter><HomePage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))

    expect(screen.getByText('Favorite Folder')).toBeInTheDocument()
    expect(screen.getByText('Favorite Notes')).toBeInTheDocument()
    expect(screen.queryByText('Normal Notes')).not.toBeInTheDocument()
    expect(screen.queryByText('Normal Folder')).not.toBeInTheDocument()
    expect(screen.queryByText('Deleted Favorite')).not.toBeInTheDocument()
  })

  it('uses favorite actions for files and folders from Home', () => {
    mockLibraryData.files = [{
      id: 'file-1',
      driveFileId: null,
      name: 'Notes',
      type: 'document',
      folderId: null,
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    }]
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: null,
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
      isDeleted: false,
      isFavorite: true,
    }]

    render(<MemoryRouter><HomePage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Add to favorites file Notes' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites folder Projects' }))

    expect(fileRepository.setFavorite).toHaveBeenCalledWith('file-1', true)
    expect(folderRepository.setFavorite).toHaveBeenCalledWith('folder-1', false)
  })
})
