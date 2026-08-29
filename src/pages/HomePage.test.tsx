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
    update: vi.fn(),
  },
  folderRepository: {
    create: vi.fn(),
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
  FileActionsMenu: ({ fileName, onDelete }: { fileName: string; onDelete: () => void }) => (
    <button type="button" onClick={onDelete}>Delete file {fileName}</button>
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
})
