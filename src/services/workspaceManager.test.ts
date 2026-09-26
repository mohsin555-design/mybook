// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../database/db'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import {
  listAllWorkspaces,
  switchWorkspace,
  createCloudWorkspaceAction,
  createLocalWorkspaceAction,
  mirrorCurrentCloudWorkspaceToLocal,
  connectCloudToLocalWorkspaceAction,
} from './workspaceManager'
import * as googleDrive from './googleDrive'
import * as localWorkspace from './localWorkspace'
import * as repositories from '../database/repositories'

describe('workspaceManager', () => {
  beforeEach(async () => {
    await db.settings.clear()
    await db.files.clear()
    await db.folders.clear()
    useAuthStore.setState({ email: null, isAuthenticated: false, displayName: null })
    useWorkspaceStore.setState({ mode: 'local', workspaceRevision: 0 })
    vi.restoreAllMocks()
  })

  it('lists local workspace when unauthenticated', async () => {
    const list = await listAllWorkspaces()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: 'local-workspace',
      type: 'local',
      name: 'Local Vault',
      isActive: true,
    })
  })

  it('lists deduplicated cloud and local workspaces when authenticated with Google', async () => {
    useAuthStore.setState({ email: 'user@example.com', isAuthenticated: true })
    useWorkspaceStore.setState({ mode: 'drive', workspaceRevision: 0 })

    vi.spyOn(googleDrive, 'listExistingDriveVaults').mockResolvedValue([
      { id: 'vault-1', name: 'Work' },
      { id: 'vault-2', name: 'Personal' },
    ])
    vi.spyOn(googleDrive, 'getDriveVaultRootName').mockResolvedValue('Work')
    await db.settings.put({ key: 'google-drive.mybook-folder-id', value: 'vault-1', updatedAt: new Date().toISOString() })

    const list = await listAllWorkspaces()
    expect(list).toHaveLength(3) // 1 local + 2 cloud
    const local = list.find((w) => w.type === 'local')
    const work = list.find((w) => w.id === 'vault-1')
    const personal = list.find((w) => w.id === 'vault-2')

    expect(local).toBeDefined()
    expect(local?.isActive).toBe(false)
    expect(work).toBeDefined()
    expect(work?.name).toBe('Work')
    expect(work?.isActive).toBe(true)
    expect(personal).toBeDefined()
    expect(personal?.name).toBe('Personal')
    expect(personal?.isActive).toBe(false)
  })

  it('switches between cloud and local workspaces', async () => {
    useAuthStore.setState({ email: 'user@example.com', isAuthenticated: true })
    useWorkspaceStore.setState({ mode: 'drive', workspaceRevision: 0 })

    const clearCacheSpy = vi.spyOn(repositories, 'clearAccountDriveCache').mockResolvedValue()
    const selectVaultSpy = vi.spyOn(googleDrive, 'selectExistingDriveVault').mockResolvedValue()

    await switchWorkspace({
      id: 'vault-2',
      name: 'Personal',
      type: 'cloud',
      driveFolderId: 'vault-2',
      isActive: false,
    })

    expect(clearCacheSpy).toHaveBeenCalled()
    expect(selectVaultSpy).toHaveBeenCalledWith('vault-2', 'Personal')
    expect(useWorkspaceStore.getState().mode).toBe('drive')
    expect(useWorkspaceStore.getState().workspaceRevision).toBe(1)

    // Switch back to local
    await switchWorkspace({
      id: 'local-workspace',
      name: 'Local Vault',
      type: 'local',
      isActive: false,
    })
    expect(useWorkspaceStore.getState().mode).toBe('local')
    expect(useWorkspaceStore.getState().workspaceRevision).toBe(2)
  })

  it('creates cloud workspace and bumps revision', async () => {
    useAuthStore.setState({ email: 'user@example.com', isAuthenticated: true })
    const clearCacheSpy = vi.spyOn(repositories, 'clearAccountDriveCache').mockResolvedValue()
    const setRootSpy = vi.spyOn(googleDrive, 'setDriveVaultRootName').mockResolvedValue()

    await createCloudWorkspaceAction('Client Projects')

    expect(clearCacheSpy).toHaveBeenCalled()
    expect(setRootSpy).toHaveBeenCalledWith('Client Projects')
    expect(useWorkspaceStore.getState().mode).toBe('drive')
    expect(useWorkspaceStore.getState().workspaceRevision).toBeGreaterThan(0)
  })

  it('creates local workspace and bumps revision', async () => {
    const initSpy = vi.spyOn(localWorkspace, 'initializeLocalWorkspace').mockResolvedValue({
      storage: 'indexeddb',
    })

    await createLocalWorkspaceAction({
      name: 'My Docs',
      storagePreference: 'private',
    })

    expect(initSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Docs', storagePreference: 'private' }))
    expect(useWorkspaceStore.getState().mode).toBe('local')
    expect(useWorkspaceStore.getState().workspaceRevision).toBeGreaterThan(0)
  })

  it('mirrors current cloud workspace to a local directory handle', async () => {
    const fakeHandle = {
      kind: 'directory',
      name: 'My Local Mirror',
    } as unknown as FileSystemDirectoryHandle

    const saveHandleSpy = vi.spyOn(localWorkspace, 'saveDeviceDirectoryHandle').mockResolvedValue()
    const saveDetailsSpy = vi.spyOn(localWorkspace, 'saveLocalWorkspaceDetails').mockResolvedValue()

    await mirrorCurrentCloudWorkspaceToLocal(fakeHandle)

    expect(saveHandleSpy).toHaveBeenCalledWith(fakeHandle)
    expect(saveDetailsSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Local Mirror', storage: 'file-system' }))
    expect(useWorkspaceStore.getState().workspaceRevision).toBeGreaterThan(0)
  })

  it('connects cloud to local workspace action', async () => {
    const selectVaultSpy = vi.spyOn(googleDrive, 'selectExistingDriveVault').mockResolvedValue()

    await connectCloudToLocalWorkspaceAction('existing-fld', 'Existing Folder')

    expect(selectVaultSpy).toHaveBeenCalledWith('existing-fld', 'Existing Folder')
    expect(useWorkspaceStore.getState().mode).toBe('drive')
    expect(useWorkspaceStore.getState().workspaceRevision).toBeGreaterThan(0)
  })
})
