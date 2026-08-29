// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FolderBreadcrumb } from './FolderBreadcrumb'
import type { MyBookFolder } from '../../types/files'

const folders: MyBookFolder[] = [
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

describe('FolderBreadcrumb', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows Library and the file for root-level files', () => {
    render(<FolderBreadcrumb currentFolderId={null} folders={folders} currentPageLabel="chromebook" onNavigate={vi.fn()} />)

    const breadcrumb = screen.getByRole('navigation', { name: 'Folder path' })

    expect(breadcrumb).toHaveTextContent('Library')
    expect(breadcrumb).toHaveTextContent('chromebook')
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('chromebook')
  })

  it('shows folder hierarchy with a file as the current page', () => {
    const onNavigate = vi.fn()

    render(<FolderBreadcrumb currentFolderId="folder-2" folders={folders} currentPageLabel="chromebook" onNavigate={onNavigate} />)

    const breadcrumb = screen.getByRole('navigation', { name: 'Folder path' })

    expect(breadcrumb).toHaveTextContent('Library')
    expect(breadcrumb).toHaveTextContent('Sharu')
    expect(breadcrumb).toHaveTextContent('Inside sharu')
    expect(breadcrumb).toHaveTextContent('chromebook')
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('chromebook')

    fireEvent.click(screen.getByRole('link', { name: 'Inside sharu' }))

    expect(onNavigate).toHaveBeenCalledWith('/folders/folder-2')
  })
})
