import { useEffect, useState } from 'react'

import { backfillLocalFoldersToDrive, ensureMyBookDriveFolder, getDriveFolderStatus, importDriveFilesToLocal, importDriveFoldersToLocal } from '../services/googleDrive'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { folderRepository, processPendingDriveFolderSync, queueLocalItemsForDriveBackup, settingsRepository } from '../database/repositories'

const DRIVE_BACKFILL_KEY = 'google-drive.folder-backfill-complete'
let importDriveBackupsFlight: Promise<void> | null = null

async function importDriveBackupsToLocal() {
  importDriveBackupsFlight ??= (async () => {
    await importDriveFoldersToLocal()
    await importDriveFilesToLocal()
  })().finally(() => {
    importDriveBackupsFlight = null
  })
  return importDriveBackupsFlight
}

export function useDriveBootstrap() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const email = useAuthStore((state) => state.email)
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const [isPreparing, setIsPreparing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (workspaceMode === 'local' || !isAuthenticated || !email) return
    let cancelled = false
    const run = async () => {
      setIsPreparing(true)
      try {
        const existingFolderId = await getDriveFolderStatus()
        const result = existingFolderId ? { success: true as const, folderId: existingFolderId, folderName: 'MyBook', created: false } : await ensureMyBookDriveFolder()
        if (!cancelled) {
          if (result.success) setFolderId(result.folderId)
          setStatusMessage(result.success
            ? result.created
              ? 'MyBook Drive folder created.'
              : 'MyBook Drive folder connected.'
            : result.error)
        }
        await processPendingDriveFolderSync()
        try {
          await importDriveBackupsToLocal()
          if (!cancelled) setStatusMessage('Synced across devices.')
        } catch (error) {
          if (!cancelled) setStatusMessage(error instanceof Error ? error.message : 'Sync paused.')
        }
        const backfillFlag = (await settingsRepository.get(DRIVE_BACKFILL_KEY)).data?.value
        if (backfillFlag !== true) {
          const folders = await folderRepository.list()
          const backfillResults = await backfillLocalFoldersToDrive(folders)
          const firstFailure = backfillResults.find((entry) => !entry.success)
          if (!cancelled) {
            if (firstFailure) setStatusMessage(firstFailure.error)
            else setStatusMessage('Existing folders were synced to Google Drive.')
          }
          await settingsRepository.update(DRIVE_BACKFILL_KEY, true)
        }
        await queueLocalItemsForDriveBackup()
        await processPendingDriveFolderSync()
      } finally {
        if (!cancelled) setIsPreparing(false)
      }
    }
    void run()
    const onlineHandler = () => {
      void processPendingDriveFolderSync().then(() => importDriveBackupsToLocal()).catch(() => undefined)
    }
    window.addEventListener('online', onlineHandler)
    return () => {
      cancelled = true
      window.removeEventListener('online', onlineHandler)
    }
  }, [email, isAuthenticated, workspaceMode])

  return { isPreparing, statusMessage, folderId }
}
