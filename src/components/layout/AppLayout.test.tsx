// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppLayout } from './AppLayout'
import type { MyBookFile, MyBookFolder } from '../../types/files'

const mockLibraryData = vi.hoisted((): { files: MyBookFile[]; folders: MyBookFolder[]; isLoading: boolean } => ({
  files: [],
  folders: [],
  isLoading: false,
}))

vi.mock('../../hooks/useDriveBootstrap', () => ({
  useDriveBootstrap: vi.fn(),
}))

vi.mock('../../hooks/useLibraryData', () => ({
  useLibraryData: () => mockLibraryData,
}))

afterEach(() => {
  cleanup()
})

describe('AppLayout sidebar favorites', () => {
  beforeEach(() => {
    mockLibraryData.files = []
    mockLibraryData.folders = []
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('keeps the Favorites section empty when there are no favorites', () => {
    renderLayout()

    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open favorite/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'See all favorites' })).not.toBeInTheDocument()
  })

  it('shows active favorite files and folders and excludes trashed favorites', () => {
    mockLibraryData.files = [
      file({ id: 'doc-1', name: 'Favorite doc', isFavorite: true, updatedAt: '2026-09-02T00:00:00.000Z' }),
      file({ id: 'doc-2', name: 'Trashed favorite', isFavorite: true, isDeleted: true, updatedAt: '2026-09-03T00:00:00.000Z' }),
      file({ id: 'doc-3', name: 'Plain doc', updatedAt: '2026-09-04T00:00:00.000Z' }),
    ]
    mockLibraryData.folders = [
      folder({ id: 'folder-1', name: 'Favorite folder', isFavorite: true, updatedAt: '2026-09-01T00:00:00.000Z' }),
      folder({ id: 'folder-2', name: 'Trashed folder', isFavorite: true, isDeleted: true, updatedAt: '2026-09-05T00:00:00.000Z' }),
    ]

    renderLayout()

    expect(screen.getByRole('link', { name: 'Open favorite document Favorite doc' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open favorite folder Favorite folder' })).toBeInTheDocument()
    expect(screen.queryByText('Trashed favorite')).not.toBeInTheDocument()
    expect(screen.queryByText('Trashed folder')).not.toBeInTheDocument()
    expect(screen.queryByText('Plain doc')).not.toBeInTheDocument()
  })

  it('shows at most five favorites directly and exposes More when more exist', () => {
    mockLibraryData.files = Array.from({ length: 6 }, (_, index) => file({
      id: `doc-${index + 1}`,
      name: `Favorite ${index + 1}`,
      isFavorite: true,
      updatedAt: `2026-09-0${index + 1}T00:00:00.000Z`,
    }))

    renderLayout()

    expect(screen.getAllByRole('link', { name: /Open favorite document Favorite/i })).toHaveLength(5)
    expect(screen.queryByText('Favorite 1')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See all favorites' })).toHaveAttribute('href', '/favorites')
  })

  it('navigates favorite files and folders by stable ID', () => {
    mockLibraryData.files = [file({ id: 'same-doc-id', name: 'Same name', isFavorite: true, updatedAt: '2026-09-02T00:00:00.000Z' })]
    mockLibraryData.folders = [folder({ id: 'same-folder-id', name: 'Same name', isFavorite: true, updatedAt: '2026-09-01T00:00:00.000Z' })]

    renderLayout()

    expect(screen.getByRole('link', { name: 'Open favorite document Same name' })).toHaveAttribute('href', '/document/same-doc-id')
    expect(screen.getByRole('link', { name: 'Open favorite folder Same name' })).toHaveAttribute('href', '/folders/same-folder-id')
  })

  it('updates immediately when favorites are added, removed, restored, or renamed', () => {
    const { rerender } = renderLayout()

    expect(screen.queryByRole('link', { name: /Open favorite/i })).not.toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Draft', isFavorite: true })]
    rerender(layoutTree())
    expect(screen.getByRole('link', { name: 'Open favorite document Draft' })).toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Renamed draft', isFavorite: true })]
    rerender(layoutTree())
    expect(screen.getByRole('link', { name: 'Open favorite document Renamed draft' })).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Renamed draft', isFavorite: true, isDeleted: true })]
    rerender(layoutTree())
    expect(screen.queryByText('Renamed draft')).not.toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Renamed draft', isFavorite: true, isDeleted: false })]
    rerender(layoutTree())
    expect(screen.getByRole('link', { name: 'Open favorite document Renamed draft' })).toBeInTheDocument()

    mockLibraryData.files = [file({ id: 'doc-1', name: 'Renamed draft', isFavorite: false })]
    rerender(layoutTree())
    expect(screen.queryByText('Renamed draft')).not.toBeInTheDocument()
  })

  it('opens the full Favorites surface from More', () => {
    mockLibraryData.files = Array.from({ length: 6 }, (_, index) => file({
      id: `doc-${index + 1}`,
      name: `Favorite ${index + 1}`,
      isFavorite: true,
      updatedAt: `2026-09-0${index + 1}T00:00:00.000Z`,
    }))

    renderLayout()

    fireEvent.click(screen.getByRole('link', { name: 'See all favorites' }))

    expect(screen.getByText('Favorites page')).toBeInTheDocument()
  })
})

function renderLayout() {
  return render(layoutTree())
}

function layoutTree() {
  return (
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<p>Home page</p>} />
          <Route path="/favorites" element={<p>Favorites page</p>} />
          <Route path="/folders/:folderId" element={<p>Folder page</p>} />
          <Route path="/document/:documentId" element={<p>Document page</p>} />
          <Route path="/spreadsheet/:spreadsheetId" element={<p>Spreadsheet page</p>} />
          <Route path="/settings" element={<p>Settings page</p>} />
          <Route path="/search" element={<p>Search page</p>} />
          <Route path="/trash" element={<p>Trash page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

function file(overrides: Partial<MyBookFile>): MyBookFile {
  return {
    id: 'file-id',
    driveFileId: null,
    name: 'File',
    type: 'document',
    folderId: null,
    content: '',
    mimeType: 'application/x-mybook-document',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    lastSyncedAt: null,
    syncStatus: 'pending',
    isDeleted: false,
    ...overrides,
  }
}

function folder(overrides: Partial<MyBookFolder>): MyBookFolder {
  return {
    id: 'folder-id',
    driveFolderId: null,
    name: 'Folder',
    parentId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    isDeleted: false,
    ...overrides,
  }
}
