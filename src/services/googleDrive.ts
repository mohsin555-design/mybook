import { useAuthStore } from '../stores/useAuthStore'
import { db } from '../database/db'
import type { JSONContent } from '@tiptap/core'

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const MYBOOK_FOLDER_NAME = 'MyBook'
const MYBOOK_FOLDER_KEY = 'google-drive.mybook-folder-id'

export interface DriveFolder {
  id: string
  name: string
  mimeType: string
  trashed?: boolean
  webViewLink?: string
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  trashed?: boolean
  webViewLink?: string
  parents?: string[]
}

export type DriveSetupResult =
  | { success: true; folderId: string; folderName: string; created: boolean }
  | { success: false; error: string }

export type DriveSyncResult =
  | { success: true; driveFolderId: string | null; created: boolean }
  | { success: false; error: string }

function buildHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) {
    return { success: false as const, error: 'Your Google session expired. Please sign in again.' }
  }

  try {
    const response = await fetch(`${DRIVE_API_BASE}${path}`, {
      ...init,
      headers: {
        ...buildHeaders(accessToken),
        ...(init.headers ?? {}),
      },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string; status?: string } } | null
      const message = body?.error?.message ?? response.statusText
      if (response.status === 401) return { success: false as const, error: 'Google session expired. Please reconnect.' }
      if (response.status === 403) return { success: false as const, error: 'Google Drive permission was denied or is unavailable.' }
      if (response.status === 404) return { success: false as const, error: 'Google Drive folder was not found.' }
      if (!navigator.onLine) return { success: false as const, error: 'You are offline. Connect to the internet and try again.' }
      return { success: false as const, error: message || 'Google Drive request failed.' }
    }

    return { success: true as const, response }
  } catch {
    return { success: false as const, error: navigator.onLine ? 'Could not reach Google Drive. Please try again.' : 'You are offline. Connect to the internet and try again.' }
  }
}

async function listChildFolders(parentId: string): Promise<DriveFolder[]> {
  const query = `'${parentId}' in parents and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`
  const result = await driveFetch(`/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name,mimeType,trashed,webViewLink)')}&spaces=drive`)
  if (!result.success) throw new Error(result.error)
  const data = await result.response.json() as { files?: DriveFolder[] }
  return data.files ?? []
}

async function listChildFiles(parentId: string): Promise<DriveFile[]> {
  const query = `'${parentId}' in parents and mimeType!='${DRIVE_FOLDER_MIME}' and trashed=false`
  const fields = 'files(id,name,mimeType,trashed,webViewLink,parents)'
  const result = await driveFetch(`/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&spaces=drive`)
  if (!result.success) throw new Error(result.error)
  const data = await result.response.json() as { files?: DriveFile[] }
  return data.files ?? []
}

async function getDriveFileContent(fileId: string) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error('Could not download the file from Google Drive.')
  }
  return await response.text()
}

export async function downloadDriveFileBlob(fileId: string): Promise<Blob> {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new Error('Could not download the Drive file.')
  return response.blob()
}

export async function listVisibleFoldersByName(name: string, parentId?: string): Promise<DriveFolder[]> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : ''
  const result = await driveFetch(`/files?q=${encodeURIComponent(`mimeType='${DRIVE_FOLDER_MIME}' and name='${name.replace(/'/g, "\\'")}' and trashed=false and 'me' in owners${parentClause}`)}&fields=${encodeURIComponent('files(id,name,mimeType,trashed,webViewLink)')}&spaces=drive`)
  if (!result.success) throw new Error(result.error)
  const data = await result.response.json() as { files?: DriveFolder[] }
  return data.files ?? []
}

export async function createVisibleFolder(name: string): Promise<DriveFolder> {
  return createVisibleFolderInParent(name, 'root')
}

export async function createVisibleFolderInParent(name: string, parentId: string): Promise<DriveFolder> {
  const result = await driveFetch('/files?fields=id,name,mimeType,trashed,webViewLink', {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: DRIVE_FOLDER_MIME,
      parents: [parentId],
    }),
  })
  if (!result.success) throw new Error(result.error)
  return await result.response.json() as DriveFolder
}

export async function ensureVisibleFolderInParent(name: string, parentId: string) {
  const matches = await listVisibleFoldersByName(name, parentId)
  const existing = matches.find((folder) => folder.mimeType === DRIVE_FOLDER_MIME && !folder.trashed)
  return existing ?? createVisibleFolderInParent(name, parentId)
}

export async function updateDriveFolder(folderId: string, changes: { name?: string; parentId?: string | null }) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const metadata: Record<string, unknown> = {}
  if (changes.name !== undefined) metadata.name = changes.name
  const params = new URLSearchParams({ fields: 'id,name,mimeType,webViewLink' })
  if (changes.parentId) {
    const currentResponse = await fetch(`${DRIVE_API_BASE}/files/${folderId}?fields=parents`, { headers: { Authorization: `Bearer ${accessToken}` } })
    const current = await currentResponse.json().catch(() => null) as { parents?: string[] } | null
    if (!current?.parents?.includes(changes.parentId)) {
      params.set('addParents', changes.parentId)
      if (current?.parents?.length) params.set('removeParents', current.parents.join(','))
    }
  }
  const response = await fetch(`${DRIVE_API_BASE}/files/${folderId}?${params.toString()}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not update the Google Drive folder.')
  }
  return await response.json() as DriveFolder
}

export async function trashDriveFolder(folderId: string) {
  return updateDriveFolderState(folderId, true)
}

export async function restoreDriveFolder(folderId: string) {
  return updateDriveFolderState(folderId, false)
}

async function updateDriveFolderState(folderId: string, trashed: boolean) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`${DRIVE_API_BASE}/files/${folderId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Could not ${trashed ? 'trash' : 'restore'} the Google Drive folder.`)
  }
}

export async function createDriveFileInFolder(name: string, content: string, mimeType: string, parentId: string) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')

  const result = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: (() => {
      const boundary = 'mybook-boundary'
      const metadata = JSON.stringify({ name, parents: [parentId], mimeType })
      return new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n`,
        `--${boundary}--`,
      ], { type: `multipart/related; boundary=${boundary}` })
    })(),
  })

  if (!result.ok) {
    const body = await result.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not create the file in Google Drive.')
  }

  return await result.json() as { id: string; name: string; webViewLink?: string }
}

export async function updateDriveFile(fileId: string, changes: { name?: string; content?: string; parentId?: string | null; mimeType?: string; trashed?: boolean }) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')

  const metadata: Record<string, unknown> = {}
  if (changes.name !== undefined) metadata.name = changes.name
  if (changes.mimeType !== undefined) metadata.mimeType = changes.mimeType
  if (changes.trashed !== undefined) metadata.trashed = changes.trashed

  const parentParams = new URLSearchParams()
  if (changes.parentId !== undefined) {
    const currentResult = await driveFetch(`/files/${encodeURIComponent(fileId)}?fields=parents`)
    if (!currentResult.success) throw new Error(currentResult.error)
    const current = await currentResult.response.json() as { parents?: string[] }
    if (changes.parentId && !current.parents?.includes(changes.parentId)) {
      parentParams.set('addParents', changes.parentId)
      if (current.parents?.length) parentParams.set('removeParents', current.parents.join(','))
    }
  }

  if (changes.content === undefined) {
    parentParams.set('fields', 'id,name,webViewLink,parents')
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${parentParams.toString()}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
      throw new Error(body?.error?.message ?? 'Could not update the file in Google Drive.')
    }
    return await response.json() as { id: string; name: string; webViewLink?: string }
  }

  const query = new URLSearchParams({ uploadType: 'multipart', fields: 'id,name,webViewLink,parents' })
  parentParams.forEach((value, key) => query.set(key, value))
  const boundary = 'mybook-update-boundary'
  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${changes.mimeType ?? 'application/json'}\r\n\r\n${changes.content ?? ''}\r\n`,
    `--${boundary}--`,
  ]

  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: new Blob(bodyParts, { type: `multipart/related; boundary=${boundary}` }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not update the file in Google Drive.')
  }

  return await response.json() as { id: string; name: string; webViewLink?: string }
}

export async function restoreDriveFile(fileId: string) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: false }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not restore the file in Google Drive.')
  }
}

export async function trashDriveFile(fileId: string) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not delete the file in Google Drive.')
  }
}

export async function retryWithBackoff<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1) break
      await new Promise((resolve) => globalThis.setTimeout(resolve, 500 * (2 ** attempt)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The operation could not be completed.')
}

function safeDocxName(name: string) {
  return name.replace(/\.docx$/i, '').trim() || 'Untitled document'
}

async function uploadDocxBlob(title: string, json: JSONContent, parentId: string, fileId?: string | null) {
  const { createDocxBlob } = await import('../utils/docx')
  const blob = await createDocxBlob(title, json)
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const safeTitle = safeDocxName(title)
  const metadata = {
    name: `${safeTitle}.docx`,
    ...(fileId ? {} : { parents: [parentId] }),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  const boundary = 'mybook-docx-boundary'
  const method = fileId ? 'PATCH' : 'POST'
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink'
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ], { type: `multipart/related; boundary=${boundary}` }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not upload the DOCX file to Google Drive.')
  }
  return await response.json() as { id: string; name: string; webViewLink?: string }
}

export async function backupDocumentToDrive(input: {
  fileId: string
  title: string
  content: string
  folderId: string | null
}): Promise<DriveSetupResult> {
  const file = await db.files.get(input.fileId)
  if (!file) return { success: false, error: 'Document could not be found.' }
  const driveBootstrap = await ensureMyBookDriveFolder()
  if (!driveBootstrap.success) return { success: false, error: driveBootstrap.error }
  const parentFolder = input.folderId ? await db.folders.get(input.folderId) : null
  const driveParentId = parentFolder?.driveFolderId ?? driveBootstrap.folderId
  try {
    await db.files.update(file.id, { syncStatus: 'backing-up', syncError: null })
    const parsedContent = (() => {
      try { return JSON.parse(input.content || '{"type":"doc","content":[{"type":"paragraph"}]}') as JSONContent } catch { return { type: 'doc', content: [{ type: 'paragraph' }] } as JSONContent }
    })()
    const result = await retryWithBackoff(() => uploadDocxBlob(input.title, parsedContent, driveParentId, file.driveFileId))
    await db.files.update(file.id, {
      driveFileId: result.id,
      syncStatus: 'backed-up',
      lastSyncedAt: new Date().toISOString(),
    })
    return { success: true, folderId: driveParentId, folderName: 'MyBook', created: !file.driveFileId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not back up the document to Google Drive.'
    await db.files.update(file.id, { syncStatus: 'failed', syncError: message })
    return { success: false, error: message }
  }
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function safeXlsxName(name: string) {
  return `${name.replace(/\.xlsx$/i, '').trim() || 'Untitled spreadsheet'}.xlsx`
}

async function uploadXlsxBlob(name: string, blob: Blob, parentId: string, fileId?: string | null) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const metadata = {
    name: safeXlsxName(name),
    ...(fileId ? {} : { parents: [parentId] }),
    mimeType: XLSX_MIME,
  }
  const boundary = 'mybook-xlsx-boundary'
  const method = fileId ? 'PATCH' : 'POST'
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,webViewLink`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink'
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ], { type: `multipart/related; boundary=${boundary}` }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? 'Could not upload the XLSX file to Google Drive.')
  }
  return await response.json() as { id: string; name: string; webViewLink?: string }
}

export async function backupSpreadsheetToDrive(input: {
  fileId: string
  title: string
  content: string
  folderId: string | null
}): Promise<DriveSetupResult> {
  const file = await db.files.get(input.fileId)
  if (!file) return { success: false, error: 'Spreadsheet could not be found.' }
  const driveBootstrap = await ensureMyBookDriveFolder()
  if (!driveBootstrap.success) return { success: false, error: driveBootstrap.error }
  const parentFolder = input.folderId ? await db.folders.get(input.folderId) : null
  const driveParentId = parentFolder?.driveFolderId ?? driveBootstrap.folderId
  try {
    await db.files.update(file.id, { syncStatus: 'backing-up', syncError: null })
    const { exportWorkbookToXlsx } = await import('../utils/xlsx')
    const snapshot = JSON.parse(input.content || '{}')
    const exported = await exportWorkbookToXlsx(snapshot)
    if (!exported.success || !exported.data) throw new Error(exported.error ?? 'Could not convert the spreadsheet to XLSX.')
    const result = await retryWithBackoff(() => uploadXlsxBlob(input.title, exported.data as Blob, driveParentId, file.driveFileId))
    await db.files.update(file.id, { driveFileId: result.id, syncStatus: 'backed-up', lastSyncedAt: new Date().toISOString() })
    return { success: true, folderId: driveParentId, folderName: 'MyBook', created: !file.driveFileId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not back up the spreadsheet to Google Drive.'
    await db.files.update(file.id, { syncStatus: 'failed', syncError: message })
    return { success: false, error: message }
  }
}

export async function openDriveFileInBrowser(fileId: string) {
  window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank', 'noopener,noreferrer')
}

export async function getDriveFileStatus(fileId: string): Promise<{ exists: boolean; modifiedTime?: string; error?: string }> {
  const result = await driveFetch(`/files/${encodeURIComponent(fileId)}?fields=id,trashed,modifiedTime`)
  if (result.success) {
    const file = await result.response.json() as { id?: string; trashed?: boolean; modifiedTime?: string }
    return { exists: Boolean(file.id) && !file.trashed, modifiedTime: file.modifiedTime }
  }
  if (result.error.includes('not found')) return { exists: false }
  return { exists: false, error: result.error }
}

export async function copyDriveFileLink(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await navigator.clipboard.writeText(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`)
    return { success: true }
  } catch {
    return { success: false, error: 'Could not copy the Google Drive link.' }
  }
}

export async function backfillLocalFoldersToDrive(folders: Array<{ id: string; name: string; parentId: string | null; driveFolderId: string | null; isDeleted?: boolean }>): Promise<DriveSyncResult[]> {
  const localFolders = folders.filter((folder) => !folder.isDeleted)
  const results: DriveSyncResult[] = []
  const pending = new Map(localFolders.map((folder) => [folder.id, folder]))
  const resolved = new Map<string, string>()

  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) return [{ success: false, error: bootstrap.error }]
  resolved.set('root', bootstrap.folderId)

  let progressed = true
  while (pending.size > 0 && progressed) {
    progressed = false
    for (const [id, folder] of pending) {
      const parentKey = folder.parentId ?? 'root'
      const parentDriveId = resolved.get(parentKey)
      if (!parentDriveId) continue
      try {
        const driveFolder = folder.driveFolderId
          ? { id: folder.driveFolderId }
          : await ensureVisibleFolderInParent(folder.name, parentDriveId)
        resolved.set(id, driveFolder.id)
        await db.folders.update(id, { driveFolderId: driveFolder.id, updatedAt: new Date().toISOString() })
        results.push({ success: true, driveFolderId: driveFolder.id, created: !folder.driveFolderId })
        pending.delete(id)
        progressed = true
      } catch (error) {
        results.push({ success: false, error: error instanceof Error ? error.message : 'Could not backfill folder.' })
        pending.delete(id)
        progressed = true
      }
    }
  }

  if (pending.size > 0) {
    results.push({ success: false, error: 'Some folders could not be backfilled because their parents were missing.' })
  }

  return results
}

export async function importDriveFoldersToLocal(
) {
  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) throw new Error(bootstrap.error)

  const localFolders = await db.folders.toArray()
  const byDriveId = new Map(localFolders.filter((folder) => folder.driveFolderId).map((folder) => [folder.driveFolderId as string, folder]))
  const byNameAndParent = new Map(localFolders.map((folder) => [`${folder.parentId ?? 'root'}:${folder.name.toLowerCase()}`, folder]))
  const seenDriveIds = new Set<string>()

  const syncChildren = async (parentDriveId: string, parentLocalId: string | null) => {
    const children = await listChildFolders(parentDriveId)
    for (const driveFolder of children) {
      seenDriveIds.add(driveFolder.id)
      const localMatch = byDriveId.get(driveFolder.id) ?? byNameAndParent.get(`${parentLocalId ?? 'root'}:${driveFolder.name.toLowerCase()}`)
      let matchedLocalId: string
      if (localMatch) {
        matchedLocalId = localMatch.id
        if (localMatch.name !== driveFolder.name || localMatch.parentId !== parentLocalId || localMatch.driveFolderId !== driveFolder.id || localMatch.isDeleted) {
          await db.folders.update(localMatch.id, { name: driveFolder.name, parentId: parentLocalId, driveFolderId: driveFolder.id, updatedAt: new Date().toISOString(), isDeleted: false })
        }
      } else {
        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        matchedLocalId = id
        await db.folders.add({ id, name: driveFolder.name, parentId: parentLocalId, driveFolderId: driveFolder.id, createdAt: now, updatedAt: now, isDeleted: false })
        byNameAndParent.set(`${parentLocalId ?? 'root'}:${driveFolder.name.toLowerCase()}`, { id, name: driveFolder.name, parentId: parentLocalId, driveFolderId: driveFolder.id, createdAt: now, updatedAt: now, isDeleted: false })
      }
      await syncChildren(driveFolder.id, matchedLocalId)
    }
  }

  await syncChildren(bootstrap.folderId, null)
  const missing = localFolders.filter((folder) => !folder.isDeleted && folder.driveFolderId && !seenDriveIds.has(folder.driveFolderId))
  for (const folder of missing) {
    const now = new Date().toISOString()
    await db.folders.update(folder.id, { driveFolderId: null, updatedAt: now })
    const existingQueue = await db.syncQueue.filter((item) => item.entityType === 'folder' && item.entityId === folder.id && item.status !== 'completed').first()
    if (existingQueue) await db.syncQueue.update(existingQueue.id, { operation: 'create', status: 'pending', errorMessage: 'The Drive folder was missing and will be recreated.', updatedAt: now })
    else await db.syncQueue.add({ id: crypto.randomUUID(), entityId: folder.id, entityType: 'folder', operation: 'create', status: 'pending', retryCount: 0, createdAt: now, updatedAt: now, errorMessage: 'The Drive folder was missing and will be recreated.' })
  }
}

function inferFileType(name: string, mimeType: string) {
  if (mimeType.includes('spreadsheet') || /\.xlsx$/i.test(name)) return 'spreadsheet' as const
  return 'document' as const
}

function inferContent(file: DriveFile) {
  return file.mimeType === 'application/json' || file.mimeType.includes('json')
    ? ''
    : ''
}

export async function importDriveFilesToLocal() {
  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) throw new Error(bootstrap.error)

  const localFolders = await db.folders.toArray()
  const localFiles = await db.files.toArray()
  const byDriveId = new Map(localFiles.filter((file) => file.driveFileId).map((file) => [file.driveFileId as string, file]))
  const byNameAndParent = new Map(localFiles.map((file) => [`${file.folderId ?? 'root'}:${file.name.toLowerCase()}`, file]))
  const folderByDriveId = new Map(localFolders.filter((folder) => folder.driveFolderId).map((folder) => [folder.driveFolderId as string, folder]))

  const syncFiles = async (parentDriveId: string, parentLocalId: string | null) => {
    const children = await listChildFiles(parentDriveId)
    for (const driveFile of children) {
      const fileType = inferFileType(driveFile.name, driveFile.mimeType)
      const existing = byDriveId.get(driveFile.id) ?? byNameAndParent.get(`${parentLocalId ?? 'root'}:${driveFile.name.toLowerCase()}`)
      const now = new Date().toISOString()
      let content = ''
      try {
        content = await getDriveFileContent(driveFile.id)
      } catch {
        content = inferContent(driveFile)
      }
      if (existing) {
        await db.files.update(existing.id, {
          name: driveFile.name,
          folderId: parentLocalId,
          driveFileId: driveFile.id,
          type: existing.type ?? fileType,
          mimeType: driveFile.mimeType || existing.mimeType,
          content: existing.content || content,
          updatedAt: now,
          isDeleted: false,
        })
      } else {
        await db.files.add({
          id: crypto.randomUUID(),
          driveFileId: driveFile.id,
          name: driveFile.name,
          type: fileType,
          folderId: parentLocalId,
          content,
          mimeType: driveFile.mimeType,
          createdAt: now,
          updatedAt: now,
          lastSyncedAt: now,
          syncStatus: 'backed-up',
          isDeleted: false,
        })
      }
    }
  }

  const walk = async (parentDriveId: string, parentLocalId: string | null) => {
    await syncFiles(parentDriveId, parentLocalId)
    const children = await listChildFolders(parentDriveId)
    for (const driveFolder of children) {
      const localMatch = folderByDriveId.get(driveFolder.id) ?? localFolders.find((folder) => folder.parentId === parentLocalId && folder.name.toLowerCase() === driveFolder.name.toLowerCase())
      const nextLocalId = localMatch?.id ?? null
      await walk(driveFolder.id, nextLocalId)
    }
  }

  await walk(bootstrap.folderId, null)
}

export async function ensureMyBookDriveFolder(): Promise<DriveSetupResult> {
  const storedFolderId = (await db.settings.get(MYBOOK_FOLDER_KEY))?.value
  if (typeof storedFolderId === 'string' && storedFolderId.trim()) {
    return { success: true, folderId: storedFolderId, folderName: MYBOOK_FOLDER_NAME, created: false }
  }

  try {
    const matches = await listVisibleFoldersByName(MYBOOK_FOLDER_NAME)
    const existing = matches.find((folder) => folder.mimeType === DRIVE_FOLDER_MIME && !folder.trashed)
    const folder = existing ?? await createVisibleFolder(MYBOOK_FOLDER_NAME)
    await db.settings.put({ key: MYBOOK_FOLDER_KEY, value: folder.id, updatedAt: new Date().toISOString() })
    return { success: true, folderId: folder.id, folderName: folder.name, created: !existing }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not prepare the MyBook Drive folder.' }
  }
}

export async function getDriveFolderStatus() {
  const stored = await db.settings.get(MYBOOK_FOLDER_KEY)
  return typeof stored?.value === 'string' ? stored.value : null
}

export function openMyBookFolderInDrive(folderId: string) {
  window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank', 'noopener,noreferrer')
}
