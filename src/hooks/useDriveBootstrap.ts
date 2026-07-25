import { useEffect, useState } from 'react'

import { backfillLocalFoldersToDrive, ensureMyBookDriveFolder, getDriveFolderStatus, importDriveFilesToLocal, importDriveFoldersToLocal } from '../services/googleDrive'
import { useAuthStore } from '../stores/useAuthStore'
import { folderRepository, processPendingDriveFolderSync, settingsRepository } from '../database/repositories'

const DRIVE_BACKFILL_KEY = 'google-drive.folder-backfill-complete'

export function useDriveBootstrap() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const email = useAuthStore((state) => state.email)
  const [isPreparing, setIsPreparing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !email) return
    let cancelled = false
    let refreshTimer: number | null = null
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') void refreshDriveMirror()
    }
    const refreshDriveMirror = async (showStatus = false) => {
      try {
        await importDriveFoldersToLocal()
        await importDriveFilesToLocal()
        if (showStatus && !cancelled) setStatusMessage('Google Drive changes were refreshed.')
      } catch (error) {
        if (showStatus && !cancelled) {
          setStatusMessage(error instanceof Error ? error.message : 'Could not refresh Google Drive changes.')
        }
      }
    }

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
        await refreshDriveMirror()
        refreshTimer = window.setInterval(() => { void refreshDriveMirror() }, 60_000)
        document.addEventListener('visibilitychange', visibilityHandler)
      } finally {
        if (!cancelled) setIsPreparing(false)
      }
    }
    void run()
    const onlineHandler = () => { void processPendingDriveFolderSync() }
    window.addEventListener('online', onlineHandler)
    return () => {
      cancelled = true
      if (refreshTimer !== null) window.clearInterval(refreshTimer)
      document.removeEventListener('visibilitychange', visibilityHandler)
      window.removeEventListener('online', onlineHandler)
    }
  }, [email, isAuthenticated])

  return { isPreparing, statusMessage, folderId }
}
