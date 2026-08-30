// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPage } from './LoginPage'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { initializeLocalWorkspace, pickLocalWorkspaceDirectory } from '../services/localWorkspace'

const mockLocalWorkspaceSupport = vi.hoisted(() => ({ canPickDeviceDirectory: false }))
const pickedDirectory = vi.hoisted(() => ({ handle: { name: 'Writing Vault' } as FileSystemDirectoryHandle, name: 'Writing Vault' }))

vi.mock('../utils/googleIdentity', () => ({
  loadGoogleIdentity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/localWorkspace', async () => {
  const actual = await vi.importActual<typeof import('../services/localWorkspace')>('../services/localWorkspace')
  return {
    ...actual,
    canPickDeviceDirectory: () => mockLocalWorkspaceSupport.canPickDeviceDirectory,
    initializeLocalWorkspace: vi.fn().mockResolvedValue({ storage: 'opfs' }),
    pickLocalWorkspaceDirectory: vi.fn().mockResolvedValue(pickedDirectory),
  }
})

function renderLoginPage() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage local workspace setup', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ mode: null })
    mockLocalWorkspaceSupport.canPickDeviceDirectory = false
    vi.mocked(initializeLocalWorkspace).mockResolvedValue({ storage: 'opfs' })
    vi.mocked(pickLocalWorkspaceDirectory).mockResolvedValue(pickedDirectory)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('defaults to private app storage when a device folder picker is unavailable', async () => {
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Create Local Workspace' }))

    expect(screen.getByRole('dialog', { name: 'Create local workspace' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Choose a folder on this device/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Use private app storage/ })).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }))

    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    expect(initializeLocalWorkspace).toHaveBeenCalledWith({
      name: 'My Workspace',
      storagePreference: 'private',
      allowPrivateFallback: true,
      directoryHandle: undefined,
    })
  })

  it('defaults to device-folder storage when supported', () => {
    mockLocalWorkspaceSupport.canPickDeviceDirectory = true
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Create Local Workspace' }))

    expect(screen.getByRole('radio', { name: /Choose a folder on this device/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Browse folder' })).toBeInTheDocument()
    expect(screen.getByText('No folder selected yet.')).toBeInTheDocument()
  })

  it('shows the selected folder and creates the workspace with that folder handle', async () => {
    mockLocalWorkspaceSupport.canPickDeviceDirectory = true
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Create Local Workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Browse folder' }))

    expect(await screen.findByText('Selected folder: Writing Vault')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }))

    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    expect(initializeLocalWorkspace).toHaveBeenCalledWith({
      name: 'My Workspace',
      storagePreference: 'file-system',
      allowPrivateFallback: false,
      directoryHandle: pickedDirectory.handle,
    })
  })

  it('requires browsing before creating a device-folder workspace', async () => {
    mockLocalWorkspaceSupport.canPickDeviceDirectory = true

    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Create Local Workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create Workspace' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a folder before creating')
    expect(screen.queryByText('Home')).not.toBeInTheDocument()
    expect(initializeLocalWorkspace).not.toHaveBeenCalled()
    expect(useWorkspaceStore.getState().mode).toBeNull()
  })
})
