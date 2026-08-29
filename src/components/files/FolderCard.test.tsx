// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FolderCard } from './FolderCard'

describe('FolderCard', () => {
  it.each([
    { fileCount: 0, folderCount: 0, label: 'Empty' },
    { fileCount: 1, folderCount: 0, label: '1 file' },
    { fileCount: 2, folderCount: 0, label: '2 files' },
    { fileCount: 0, folderCount: 1, label: '1 folder' },
    { fileCount: 0, folderCount: 2, label: '2 folders' },
    { fileCount: 2, folderCount: 1, label: '2 files, 1 folder' },
    { fileCount: 1, folderCount: 2, label: '1 file, 2 folders' },
  ])('shows $label for folder contents', ({ fileCount, folderCount, label }) => {
    render(<FolderCard name="Projects" fileCount={fileCount} folderCount={folderCount} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
