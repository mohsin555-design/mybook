import { db } from '../database/db'
import type { SyncConflict } from '../types/files'

// Keeps the local document and stores the remote content as a recoverable
// version, so a remote edit is never dropped without a trace.
export async function recordRemoteConflict(fileId: string, remoteContent: string, remoteModifiedTime: string) {
  const file = await db.files.get(fileId)
  if (!file) return null
  if (file.syncConflict?.remoteModifiedTime === remoteModifiedTime) return file.syncConflict

  const conflict: SyncConflict = { remoteModifiedTime, versionId: crypto.randomUUID(), detectedAt: new Date().toISOString() }
  await db.transaction('rw', db.files, db.fileVersions, async () => {
    await db.fileVersions.add({
      id: conflict.versionId,
      fileId,
      source: 'drive',
      content: remoteContent,
      name: file.name,
      mimeType: file.mimeType,
      driveFileId: file.driveFileId,
      driveModifiedTime: remoteModifiedTime,
      createdAt: conflict.detectedAt,
      label: 'Remote version (not applied)',
    })
    await db.files.update(fileId, { syncConflict: conflict })
  })
  return conflict
}

// Local edits win. The remote version stays in history and is acknowledged, so
// only newer remote changes raise another conflict.
export async function keepLocalVersion(fileId: string) {
  const file = await db.files.get(fileId)
  if (!file?.syncConflict) return
  await db.files.update(fileId, {
    syncConflict: null,
    lastSyncedAt: file.syncConflict.remoteModifiedTime,
    syncStatus: 'pending',
  })
}

export async function applyRemoteVersion(fileId: string) {
  const file = await db.files.get(fileId)
  const conflict = file?.syncConflict
  if (!file || !conflict) return false
  const remote = await db.fileVersions.get(conflict.versionId)
  if (!remote) return false

  await db.transaction('rw', db.files, db.fileVersions, async () => {
    await db.fileVersions.add({
      id: crypto.randomUUID(),
      fileId,
      source: 'local',
      content: file.content,
      name: file.name,
      mimeType: file.mimeType,
      driveFileId: file.driveFileId,
      driveModifiedTime: conflict.remoteModifiedTime,
      createdAt: new Date().toISOString(),
      label: 'Before using remote version',
    })
    await db.files.update(fileId, {
      content: remote.content,
      baseContent: remote.content,
      syncConflict: null,
      lastSyncedAt: conflict.remoteModifiedTime,
      syncStatus: 'backed-up',
      syncError: null,
      updatedAt: conflict.remoteModifiedTime,
    })
  })
  return true
}
