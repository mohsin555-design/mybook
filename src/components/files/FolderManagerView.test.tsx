// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MouseEvent } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FolderManagerView } from './FolderManagerView'
import { fileRepository, folderRepository } from '../../database/repositories'
import { toast } from '../ui/toast'
import type { MyBookFile, MyBookFolder } from '../../types/files'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockLibraryData = vi.hoisted((): { files: MyBookFile[]; folders: MyBookFolder[] } => ({
  files: [],
  folders: [],
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../hooks/useLibraryData', () => ({
  useLibraryData: () => ({ ...mockLibraryData, isLoading: false }),
}))

vi.mock('../../database/repositories', () => ({
  fileRepository: {
    delete: vi.fn(),
    duplicate: vi.fn(),
    restore: vi.fn(),
    update: vi.fn(),
  },
  folderRepository: {
    create: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../ui/toast', () => ({
  toast: {
    add: vi.fn(),
  },
}))

vi.mock('./CreateItemDrawer', () => ({
  CreateItemDrawer: ({ onCreateFolder }: { onCreateFolder: () => void }) => (
    <button type="button" onClick={onCreateFolder}>New folder</button>
  ),
}))

vi.mock('./FileActionsMenu', () => ({
  FileActionsMenu: ({ fileName, onDelete }: { fileName: string; onDelete: () => void }) => (
    <button type="button" onClick={onDelete}>Delete file {fileName}</button>
  ),
}))

vi.mock('./FolderActionsMenu', () => ({
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

describe('FolderManagerView folder creation', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockLibraryData.files = []
    mockLibraryData.folders = []
    vi.mocked(folderRepository.create).mockReset()
    vi.mocked(folderRepository.delete).mockReset()
    vi.mocked(folderRepository.restore).mockReset()
    vi.mocked(fileRepository.delete).mockReset()
    vi.mocked(fileRepository.restore).mockReset()
    vi.mocked(fileRepository.delete).mockResolvedValue({ success: true })
    vi.mocked(folderRepository.delete).mockResolvedValue({ success: true })
    vi.mocked(toast.add).mockReset()
  })

  it('navigates into newly created folders and shows a success toast', async () => {
    vi.mocked(folderRepository.create).mockResolvedValue({
      success: true,
      data: {
        id: 'folder-2',
        driveFolderId: null,
        name: 'Archive',
        parentId: null,
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
        isDeleted: false,
      },
    })

    render(<MemoryRouter><FolderManagerView folderId={null} /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'New folder' }))
    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'Archive' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/folders/folder-2'))
    expect(toast.add).toHaveBeenCalledWith({
      title: '"Archive" created',
      type: 'success',
      priority: 'low',
    })
  })

  it('shows an accessible breadcrumb path for nested folders', () => {
    mockLibraryData.folders = [
      {
        id: 'folder-1',
        driveFolderId: null,
        name: 'Sharu',
        parentId: null,
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
        isDeleted: false,
      },
      {
        id: 'folder-2',
        driveFolderId: null,
        name: 'Inside sharu',
        parentId: 'folder-1',
        createdAt: '2026-08-29T00:00:00.000Z',
        updatedAt: '2026-08-29T00:00:00.000Z',
        isDeleted: false,
      },
    ]

    render(<MemoryRouter><FolderManagerView folderId="folder-2" /></MemoryRouter>)

    const breadcrumb = screen.getByRole('navigation', { name: 'Folder path' })

    expect(breadcrumb).toHaveTextContent('Library')
    expect(breadcrumb).toHaveTextContent('Sharu')
    expect(breadcrumb).toHaveTextContent('Inside sharu')
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Inside sharu')

    fireEvent.click(screen.getByRole('link', { name: 'Sharu' }))

    expect(mockNavigate).toHaveBeenCalledWith('/folders/folder-1')
  })

  it('requires confirmation before deleting a file inside a folder', async () => {
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: null,
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      isDeleted: false,
    }]
    mockLibraryData.files = [{
      id: 'file-1',
      driveFileId: null,
      name: 'Notes',
      type: 'document',
      folderId: 'folder-1',
      content: '',
      mimeType: 'application/x-mybook-document',
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      lastSyncedAt: null,
      syncStatus: 'pending',
      isDeleted: false,
    }]

    render(<MemoryRouter><FolderManagerView folderId="folder-1" /></MemoryRouter>)

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

  it('requires confirmation before deleting an empty folder', async () => {
    mockLibraryData.folders = [{
      id: 'folder-1',
      driveFolderId: null,
      name: 'Projects',
      parentId: null,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
      isDeleted: false,
    }]

    render(<MemoryRouter><FolderManagerView folderId={null} /></MemoryRouter>)

    const [deleteButton] = screen.getAllByRole('button', { name: 'Delete folder Projects' })
    expect(deleteButton).toBeDefined()
    fireEvent.click(deleteButton!)

    expect(folderRepository.delete).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Move "Projects" to Trash?')

    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }))

    await waitFor(() => expect(folderRepository.delete).toHaveBeenCalledWith('folder-1'))
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({
      title: '"Projects" deleted',
      type: 'success',
      priority: 'low',
    }))

    const toastArg = vi.mocked(toast.add).mock.calls.at(-1)?.[0]
    toastArg?.actionProps?.onClick?.({} as MouseEvent<HTMLButtonElement>)
    expect(folderRepository.restore).toHaveBeenCalledWith('folder-1')
  })
})
