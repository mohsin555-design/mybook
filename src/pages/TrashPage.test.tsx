// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { TrashPage } from './TrashPage'
import { fileRepository } from '../database/repositories'
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
}))

vi.mock('../components/files/TrashActionsMenu', () => ({
  TrashActionsMenu: ({ fileName, onDelete }: { fileName: string; onDelete: () => void }) => (
    <button type="button" onClick={onDelete}>Delete permanently {fileName}</button>
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
})
