import { useEffect, useState } from 'react'

import { backfillLocalFoldersToDrive, ensureMyBookDriveFolder, importDriveFilesToLocal, importDriveFoldersToLocal } from '../services/googleDrive'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { folderRepository, processPendingDriveFolderSync, queueLocalItemsForDriveBackup, settingsRepository } from '../database/repositories'

const DRIVE_BACKFILL_KEY = 'google-drive.folder-backfill-complete'
const DRIVE_INITIAL_SYNC_KEY = (email: string) => `google-drive.initial-sync-complete:${email}`
let importDriveBackupsFlight: Promise<void> | null = null

async function importDriveBackupsToLocal(
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void,
) {
  importDriveBackupsFlight ??= (async () => {
    await importDriveFoldersToLocal((p) => {
      onProgress?.({ loaded: p.loaded, total: p.total, percent: Math.round(p.percent * 0.3) })
    })
    await importDriveFilesToLocal((p) => {
      onProgress?.({ loaded: p.loaded, total: p.total, percent: 30 + Math.round(p.percent * 0.7) })
    })
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
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)
  const [fetchProgress, setFetchProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (workspaceMode === 'local' || !isAuthenticated || !email) return
    let cancelled = false
    const run = async () => {
      setIsPreparing(true)
      const initialSyncFlag = (await settingsRepository.get(DRIVE_INITIAL_SYNC_KEY(email))).data?.value === true
      const shouldShowInitialFetch = !initialSyncFlag

      if (shouldShowInitialFetch && !cancelled) {
        setIsFetchingFiles(true)
        setFetchProgress(5)
      }

      try {
        const result = await ensureMyBookDriveFolder()
        if (!cancelled) {
          if (result.success) setFolderId(result.folderId)
          setStatusMessage(result.success
            ? result.created
              ? 'Writin Drive folder created.'
              : 'Writin Drive folder connected.'
            : result.error)
        }
        if (!result.success) return
        if (shouldShowInitialFetch && !cancelled) {
          setFetchProgress(15)
        }
        await processPendingDriveFolderSync()
        try {
          await importDriveBackupsToLocal((p) => {
            if (shouldShowInitialFetch && !cancelled) {
              setFetchProgress(15 + Math.round(p.percent * 0.75))
            }
          })
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
        if (shouldShowInitialFetch && !cancelled) {
          setFetchProgress(100)
          await settingsRepository.update(DRIVE_INITIAL_SYNC_KEY(email), true)
        }
      } catch (error) {
        if (!cancelled) setStatusMessage(error instanceof Error ? error.message : 'Sync paused. Please retry.')
      } finally {
        if (!cancelled) {
          setIsFetchingFiles(false)
          setIsPreparing(false)
        }
      }
    }
    void run()
    const onlineHandler = () => {
      void run()
    }
    window.addEventListener('online', onlineHandler)
    return () => {
      cancelled = true
      window.removeEventListener('online', onlineHandler)
    }
  }, [email, isAuthenticated, workspaceMode])

  return { isPreparing, isFetchingFiles, fetchProgress, statusMessage, folderId }
}
