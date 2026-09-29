import { db } from '../database/db'
import { clearAccountDriveCache } from '../database/repositories'
import {
  getDriveVaultRootName,
  listExistingDriveVaults,
  selectExistingDriveVault,
  setDriveVaultRootName,
  type DriveVaultSummary,
} from './googleDrive'
import {
  checkDeviceDirectoryHandleValid,
  ensureLocalWorkspaceFolder,
  forgetDeviceDirectoryHandle,
  getDeviceDirectoryHandle,
  getLocalWorkspaceDetails,
  initializeLocalWorkspace,
  saveDeviceDirectoryHandle,
  saveLocalWorkspaceDetails,
  writeLocalWorkspaceFile,
  type LocalWorkspaceStoragePreference,
} from './localWorkspace'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { useAuthStore } from '../stores/useAuthStore'

export interface AppWorkspaceItem {
  id: string
  name: string
  type: 'cloud' | 'local'
  driveFolderId?: string
  hasLocalMirror?: boolean
  localFolderName?: string
  isActive: boolean
}

export async function listAllWorkspaces(): Promise<AppWorkspaceItem[]> {
  const workspaceState = useWorkspaceStore.getState()
  const workspaceMode = workspaceState.mode
  const isMirrorMissing = workspaceState.isMirrorFolderMissing
  const isAuthenticated = useAuthStore.getState().isAuthenticated
  const localDetails = await getLocalWorkspaceDetails()
  const activeDriveName = await getDriveVaultRootName()
  const activeDriveFolderId = (await db.settings.get('google-drive.mybook-folder-id'))?.value as string | undefined

  let localHandle: FileSystemDirectoryHandle | null = null
  if (!isMirrorMissing) {
    const rawHandle = await getDeviceDirectoryHandle()
    if (rawHandle) {
      const validity = await checkDeviceDirectoryHandleValid(rawHandle)
      if (validity.valid) {
        localHandle = validity.handle ?? rawHandle
      } else if (validity.error === 'NotFoundError') {
        await forgetDeviceDirectoryHandle()
        useWorkspaceStore.getState().setMirrorFolderMissing(true)
        localHandle = null
      }
    }
  }

  const workspaces: AppWorkspaceItem[] = []

  // 1. Cloud Workspaces (if authenticated with Google)
  if (isAuthenticated) {
    let driveVaults: DriveVaultSummary[] = []
    try {
      driveVaults = await listExistingDriveVaults()
    } catch {
      driveVaults = []
    }

    // If active drive folder is known but not returned in discovery, ensure it is in the list
    if (activeDriveFolderId && !driveVaults.some((v) => v.id === activeDriveFolderId)) {
      driveVaults.unshift({
        id: activeDriveFolderId,
        name: activeDriveName || 'Writin',
      })
    } else if (driveVaults.length === 0 && workspaceMode === 'drive') {
      driveVaults.push({
        id: activeDriveFolderId || 'active-drive-vault',
        name: activeDriveName || 'Writin',
      })
    }

    for (const vault of driveVaults) {
      const isThisActive = workspaceMode === 'drive' && (vault.id === activeDriveFolderId || vault.name.toLowerCase() === activeDriveName.toLowerCase())
      workspaces.push({
        id: vault.id,
        name: vault.name,
        type: 'cloud',
        driveFolderId: vault.id,
        hasLocalMirror: isThisActive && Boolean(localHandle) && !isMirrorMissing,
        localFolderName: isThisActive && localHandle && !isMirrorMissing ? localHandle.name : undefined,
        isActive: isThisActive,
      })
    }
  }

  // 2. Local Workspace item
  // Only include local workspace if:
  // - Not authenticated (offline/local only), OR
  // - Currently in local mode
  const isLocalActive = workspaceMode === 'local'
  const shouldIncludeLocalWorkspace = !isAuthenticated || isLocalActive

  if (shouldIncludeLocalWorkspace) {
    const localName = localDetails?.name || (localHandle ? localHandle.name : 'Local Vault')
    workspaces.push({
      id: 'local-workspace',
      name: localName,
      type: 'local',
      hasLocalMirror: Boolean(localHandle) && !isMirrorMissing,
      localFolderName: !isMirrorMissing && localHandle ? localHandle.name : undefined,
      isActive: isLocalActive,
    })
  }

  return workspaces
}

export async function switchWorkspace(target: AppWorkspaceItem): Promise<void> {
  if (target.isActive) return

  if (target.type === 'local') {
    useWorkspaceStore.getState().createLocalWorkspace()
    return
  }

  // Switching to a Cloud workspace:
  await clearAccountDriveCache().catch(() => undefined)
  if (target.driveFolderId && target.driveFolderId !== 'active-drive-vault') {
    await selectExistingDriveVault(target.driveFolderId, target.name)
  } else {
    await setDriveVaultRootName(target.name)
  }
  useWorkspaceStore.getState().selectGoogleWorkspace()
}

export async function createCloudWorkspaceAction(
  name: string,
  directoryHandle?: FileSystemDirectoryHandle,
): Promise<void> {
  const trimmed = name.trim() || 'Writin'
  await clearAccountDriveCache().catch(() => undefined)
  await db.settings.delete('google-drive.mybook-folder-id')
  await setDriveVaultRootName(trimmed)
  if (directoryHandle) {
    await saveDeviceDirectoryHandle(directoryHandle)
    await saveLocalWorkspaceDetails({
      name: trimmed,
      storage: 'file-system',
      createdAt: new Date().toISOString(),
    })
  }
  useWorkspaceStore.getState().selectGoogleWorkspace()
}

export async function createLocalWorkspaceAction({
  name = 'Writin',
  directoryHandle,
  storagePreference = directoryHandle ? 'file-system' : 'private',
}: {
  name?: string
  directoryHandle?: FileSystemDirectoryHandle
  storagePreference?: LocalWorkspaceStoragePreference
}): Promise<void> {
  await initializeLocalWorkspace({
    name,
    directoryHandle,
    storagePreference,
    allowPrivateFallback: storagePreference !== 'file-system',
  })
  useWorkspaceStore.getState().createLocalWorkspace()
}

export async function mirrorCurrentCloudWorkspaceToLocal(
  directoryHandle: FileSystemDirectoryHandle,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const store = useWorkspaceStore.getState()
  store.setMirrorProgress({ isMirroring: true, progress: 0 })
  onProgress?.(0)

  try {
    const activeDriveName = (await getDriveVaultRootName()) || 'Writin'
    await saveDeviceDirectoryHandle(directoryHandle)
    await saveLocalWorkspaceDetails({
      name: activeDriveName,
      storage: 'file-system',
      createdAt: new Date().toISOString(),
    })
    const activeFolders = await db.folders.filter((f) => !f.isDeleted).toArray()
    const activeFiles = await db.files.filter((f) => !f.isDeleted).toArray()
    const totalItems = activeFolders.length + activeFiles.length
    let completed = 0

    const stepProgress = () => {
      completed += 1
      const pct = totalItems > 0 ? Math.round((completed / totalItems) * 100) : 100
      store.setMirrorProgress({ isMirroring: true, progress: pct })
      onProgress?.(pct)
    }

    for (const folder of activeFolders) {
      await ensureLocalWorkspaceFolder(folder.id).catch(() => undefined)
      stepProgress()
    }
    for (const f of activeFiles) {
      await writeLocalWorkspaceFile(f).catch(() => undefined)
      stepProgress()
    }
    store.setMirrorProgress({ isMirroring: false, progress: 100 })
    useWorkspaceStore.getState().bumpWorkspaceRevision()
  } catch (err) {
    store.setMirrorProgress({ isMirroring: false, progress: 0 })
    throw err
  }
}

export async function connectCloudToLocalWorkspaceAction(
  folderId?: string,
  folderName?: string,
): Promise<void> {
  if (folderId && folderName) {
    await selectExistingDriveVault(folderId, folderName)
  } else if (folderName) {
    await setDriveVaultRootName(folderName)
  }
  useWorkspaceStore.getState().selectGoogleWorkspace()
}
