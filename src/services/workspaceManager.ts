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
  const workspaceMode = useWorkspaceStore.getState().mode
  const isAuthenticated = useAuthStore.getState().isAuthenticated
  const localDetails = await getLocalWorkspaceDetails()
  const localHandle = await getDeviceDirectoryHandle()
  const activeDriveName = await getDriveVaultRootName()
  const activeDriveFolderId = (await db.settings.get('google-drive.mybook-folder-id'))?.value as string | undefined

  const workspaces: AppWorkspaceItem[] = []

  // 1. Local Workspace item
  const localName = localDetails?.name || (localHandle ? localHandle.name : 'Local Vault')
  const isLocalActive = workspaceMode === 'local'

  workspaces.push({
    id: 'local-workspace',
    name: localName,
    type: 'local',
    hasLocalMirror: Boolean(localHandle),
    localFolderName: localHandle?.name,
    isActive: isLocalActive,
  })

  // 2. Cloud Workspaces (if authenticated with Google)
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
        hasLocalMirror: isThisActive && Boolean(localHandle),
        localFolderName: isThisActive && localHandle ? localHandle.name : undefined,
        isActive: isThisActive,
      })
    }
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
      name: directoryHandle.name,
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
): Promise<void> {
  await saveDeviceDirectoryHandle(directoryHandle)
  await saveLocalWorkspaceDetails({
    name: directoryHandle.name,
    storage: 'file-system',
    createdAt: new Date().toISOString(),
  })
  const activeFiles = await db.files.filter((f) => !f.isDeleted).toArray()
  for (const f of activeFiles) {
    await writeLocalWorkspaceFile(f).catch(() => undefined)
  }
  useWorkspaceStore.getState().bumpWorkspaceRevision()
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
