// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MissingMirrorModal } from './MissingMirrorModal'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import * as localWorkspace from '../../services/localWorkspace'
import * as workspaceManager from '../../services/workspaceManager'

describe('MissingMirrorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({ isMirrorFolderMissing: false })
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render when isMirrorFolderMissing is false', () => {
    const { container } = render(<MissingMirrorModal />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal when isMirrorFolderMissing is true', () => {
    useWorkspaceStore.setState({ isMirrorFolderMissing: true })
    render(<MissingMirrorModal />)
    expect(screen.getByText('Mirrored Local Folder Not Found')).toBeInTheDocument()
    expect(screen.getByText('Keep in Cloud Only')).toBeInTheDocument()
    expect(screen.getByText('Choose New Folder')).toBeInTheDocument()
  })

  it('switches to cloud-only when "Keep in Cloud Only" is clicked', async () => {
    const forgetSpy = vi.spyOn(localWorkspace, 'forgetDeviceDirectoryHandle').mockResolvedValue()
    useWorkspaceStore.setState({ isMirrorFolderMissing: true })
    render(<MissingMirrorModal />)

    fireEvent.click(screen.getByText('Keep in Cloud Only'))

    await waitFor(() => {
      expect(forgetSpy).toHaveBeenCalled()
      expect(useWorkspaceStore.getState().isMirrorFolderMissing).toBe(false)
    })
  })

  it('re-mirrors to new folder when "Choose New Folder" is clicked', async () => {
    const fakeHandle = { name: 'New Folder', kind: 'directory' } as unknown as FileSystemDirectoryHandle
    vi.spyOn(localWorkspace, 'pickLocalWorkspaceDirectory').mockResolvedValue({ handle: fakeHandle, name: 'New Folder' })
    const mirrorSpy = vi.spyOn(workspaceManager, 'mirrorCurrentCloudWorkspaceToLocal').mockResolvedValue()

    useWorkspaceStore.setState({ isMirrorFolderMissing: true })
    render(<MissingMirrorModal />)

    fireEvent.click(screen.getByText('Choose New Folder'))

    await waitFor(() => {
      expect(mirrorSpy).toHaveBeenCalledWith(fakeHandle)
      expect(useWorkspaceStore.getState().isMirrorFolderMissing).toBe(false)
    })
  })
})
