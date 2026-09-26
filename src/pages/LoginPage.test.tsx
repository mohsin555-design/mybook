// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPage } from './LoginPage'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { initializeLocalWorkspace, pickLocalWorkspaceDirectory } from '../services/localWorkspace'
import { listExistingDriveVaults, selectExistingDriveVault } from '../services/googleDrive'

const mockLocalWorkspaceSupport = vi.hoisted(() => ({ canPickDeviceDirectory: false }))
const pickedDirectory = vi.hoisted(() => ({ handle: { name: 'Writing Vault' } as FileSystemDirectoryHandle, name: 'Writing Vault' }))

vi.mock('../utils/googleIdentity', async () => {
  const actual = await vi.importActual<typeof import('../utils/googleIdentity')>('../utils/googleIdentity')
  return {
    ...actual,
    loadGoogleIdentity: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../services/googleDrive', () => ({
  listExistingDriveVaults: vi.fn().mockResolvedValue([]),
  selectExistingDriveVault: vi.fn().mockResolvedValue(undefined),
  setDriveVaultRootName: vi.fn().mockResolvedValue(undefined),
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

function createGoogleCredential(payload: Record<string, unknown>) {
  return [
    'header',
    btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    'signature',
  ].join('.')
}

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
  let mockInitialize: ReturnType<typeof vi.fn>
  let mockRenderButton: ReturnType<typeof vi.fn>

  beforeEach(() => {
    useWorkspaceStore.setState({ mode: null })
    mockLocalWorkspaceSupport.canPickDeviceDirectory = false
    vi.mocked(initializeLocalWorkspace).mockResolvedValue({ storage: 'opfs' })
    vi.mocked(pickLocalWorkspaceDirectory).mockResolvedValue(pickedDirectory)
    mockInitialize = vi.fn()
    mockRenderButton = vi.fn()
    window.google = {
      accounts: {
        id: {
          initialize: mockInitialize,
          renderButton: mockRenderButton,
        },
        oauth2: {
          initTokenClient: vi.fn().mockImplementation(({ callback }) => ({
            requestAccessToken: vi.fn().mockImplementation(() => {
              callback({ access_token: 'test-token', expires_in: 3600 })
            }),
          })),
        },
      },
    } as unknown as typeof window.google
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('defaults to private app storage when a device folder picker is unavailable', async () => {
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Create a Private Device Vault' }))

    expect(screen.getByRole('dialog', { name: 'Create Private Device Vault' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Choose a folder on this device/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Use private device storage/ })).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Open Vault' }))

    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    expect(initializeLocalWorkspace).toHaveBeenCalledWith({
      name: 'Writin',
      storagePreference: 'private',
      allowPrivateFallback: true,
      directoryHandle: undefined,
    })
  })

  it('defaults to device-folder storage when supported', () => {
    mockLocalWorkspaceSupport.canPickDeviceDirectory = true
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Select a Local Vault Folder' }))

    expect(screen.getByRole('radio', { name: /Choose a folder on this device/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Browse folder' })).toBeInTheDocument()
    expect(screen.getByText('No folder selected yet.')).toBeInTheDocument()
  })

  it('shows the selected folder and creates the workspace with that folder handle', async () => {
    mockLocalWorkspaceSupport.canPickDeviceDirectory = true
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Select a Local Vault Folder' }))
    fireEvent.click(screen.getByRole('button', { name: 'Browse folder' }))

    expect(await screen.findByText('Selected folder: Writing Vault')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Vault' }))

    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    expect(initializeLocalWorkspace).toHaveBeenCalledWith({
      name: 'Writing Vault',
      storagePreference: 'file-system',
      allowPrivateFallback: false,
      directoryHandle: pickedDirectory.handle,
    })
  })

  it('requires browsing before creating a device-folder workspace', async () => {
    mockLocalWorkspaceSupport.canPickDeviceDirectory = true

    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: 'Select a Local Vault Folder' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Vault' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a folder before creating')
    expect(screen.queryByText('Home')).not.toBeInTheDocument()
    expect(initializeLocalWorkspace).not.toHaveBeenCalled()
    expect(useWorkspaceStore.getState().mode).toBeNull()
  })

  it('renders existing Drive vaults and selects the chosen vault', async () => {
    vi.mocked(listExistingDriveVaults).mockResolvedValue([
      { id: 'vault-1', name: 'Work Notes' },
      { id: 'vault-2', name: 'Personal' },
    ])

    renderLoginPage()

    await waitFor(() => expect(mockInitialize).toHaveBeenCalled())
    const options = mockInitialize.mock.calls[0]?.[0]
    const credential = createGoogleCredential({ email: 'test@example.com', email_verified: true })
    options?.callback({ credential, select_by: 'user' })

    expect(await screen.findByText('Set Up Google Drive Vault')).toBeInTheDocument()
    expect(await screen.findByText('Work Notes')).toBeInTheDocument()
    expect(screen.getByText('Personal')).toBeInTheDocument()

    // Select Personal vault
    const personalRadio = screen.getByRole('radio', { name: /Personal/i })
    fireEvent.click(personalRadio)

    fireEvent.click(screen.getByRole('button', { name: 'Open Vault' }))

    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument())
    expect(selectExistingDriveVault).toHaveBeenCalledWith('vault-2', 'Personal')
    expect(useWorkspaceStore.getState().mode).toBe('drive')
  })
})
