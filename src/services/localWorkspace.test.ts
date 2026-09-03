// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../database/db'
import { initializeLocalWorkspace, pickLocalWorkspaceDirectory } from './localWorkspace'

function directoryHandle(name: string) {
  const filesDirectory = {
    getDirectoryHandle: vi.fn(),
  }
  const workspaceDirectory = {
    getDirectoryHandle: vi.fn().mockResolvedValue(filesDirectory),
  }
  const rootDirectory = {
    name,
    queryPermission: vi.fn().mockResolvedValue('prompt'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    getDirectoryHandle: vi.fn().mockResolvedValue(workspaceDirectory),
  }

  return { rootDirectory, workspaceDirectory, filesDirectory }
}

describe('local workspace permissions', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist: vi.fn().mockResolvedValue(true) },
    })
  })

  it('uses the folder picker result without requesting permission a second time', async () => {
    const { rootDirectory } = directoryHandle('Writing Vault')
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn().mockResolvedValue(rootDirectory),
    })

    const result = await pickLocalWorkspaceDirectory()

    expect(result).toEqual({ handle: rootDirectory, name: 'Writing Vault' })
    expect(rootDirectory.requestPermission).not.toHaveBeenCalled()
  })

  it('creates the selected device-folder workspace without re-prompting for permission', async () => {
    const { rootDirectory, workspaceDirectory } = directoryHandle('Writing Vault')
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn().mockResolvedValue(rootDirectory),
    })

    await initializeLocalWorkspace({
      name: 'My Workspace',
      storagePreference: 'file-system',
      allowPrivateFallback: false,
      directoryHandle: rootDirectory as unknown as FileSystemDirectoryHandle,
    })

    expect(rootDirectory.requestPermission).not.toHaveBeenCalled()
    expect(rootDirectory.getDirectoryHandle).toHaveBeenCalledWith('Writin', { create: true })
    expect(workspaceDirectory.getDirectoryHandle).toHaveBeenCalledWith('files', { create: true })
  })
})
