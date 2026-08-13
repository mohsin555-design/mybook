import { useAuthStore } from '../stores/useAuthStore'
import { db } from '../database/db'
import type { JSONContent } from '@tiptap/core'

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet'
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
  modifiedTime?: string
}

export type DriveSetupResult =
  | { success: true; folderId: string; folderName: string; created: boolean; modifiedTime?: string }
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
  const fields = 'files(id,name,mimeType,trashed,webViewLink,parents,modifiedTime)'
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

async function getDriveFileBlob(fileId: string) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Could not download the file from Google Drive.')
  return response.blob()
}

async function exportGoogleWorkspaceFile(fileId: string, mimeType: string) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const response = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(mimeType)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Could not export the Google Drive file.')
  return response.blob()
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

  return await result.json() as { id: string; name: string; webViewLink?: string; modifiedTime?: string }
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

const backupFlights = new Map<string, Promise<DriveSetupResult>>()

async function runSingleFileBackup(fileId: string, task: () => Promise<DriveSetupResult>) {
  const active = backupFlights.get(fileId)
  if (active) return active
  const next = task().finally(() => {
    if (backupFlights.get(fileId) === next) backupFlights.delete(fileId)
  })
  backupFlights.set(fileId, next)
  return next
}

async function uploadDocxBlob(title: string, json: JSONContent, parentId: string, fileId?: string | null, targetMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  const { createDocxBlob } = await import('../utils/docx')
  const blob = await createDocxBlob(title, json)
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const safeTitle = safeDocxName(title)
  const metadata = {
    name: targetMimeType === GOOGLE_DOC_MIME ? safeTitle : `${safeTitle}.docx`,
    ...(fileId ? {} : { parents: [parentId] }),
    mimeType: targetMimeType,
  }
  const boundary = 'mybook-docx-boundary'
  const method = fileId ? 'PATCH' : 'POST'
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime'
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
  return await response.json() as { id: string; name: string; webViewLink?: string; modifiedTime?: string }
}

export async function backupDocumentToDrive(input: {
  fileId: string
  title: string
  content: string
  folderId: string | null
}): Promise<DriveSetupResult> {
  return runSingleFileBackup(input.fileId, async () => {
    const file = await db.files.get(input.fileId)
    if (!file) return { success: false, error: 'Document could not be found.' }
    const driveBootstrap = await ensureMyBookDriveFolder()
    if (!driveBootstrap.success) return { success: false, error: driveBootstrap.error }
    const parentFolder = input.folderId ? await db.folders.get(input.folderId) : null
    const driveParentId = parentFolder?.driveFolderId ?? driveBootstrap.folderId
    try {
      await db.files.update(file.id, { syncStatus: 'backing-up', syncError: null })
      const latest = await db.files.get(input.fileId)
      const content = latest?.content ?? input.content
      const title = latest?.name ?? input.title
      const parsedContent = (() => {
        try { return JSON.parse(content || '{"type":"doc","content":[{"type":"paragraph"}]}') as JSONContent } catch { return { type: 'doc', content: [{ type: 'paragraph' }] } as JSONContent }
      })()
      const result = await retryWithBackoff(() => uploadDocxBlob(title, parsedContent, driveParentId, latest?.driveFileId ?? file.driveFileId, latest?.mimeType === GOOGLE_DOC_MIME ? GOOGLE_DOC_MIME : undefined))
      await db.files.update(file.id, {
        driveFileId: result.id,
        syncStatus: 'backed-up',
        lastSyncedAt: result.modifiedTime ?? latest?.lastSyncedAt ?? file.lastSyncedAt ?? new Date().toISOString(),
      })
      return { success: true, folderId: driveParentId, folderName: 'MyBook', created: !(latest?.driveFileId ?? file.driveFileId), modifiedTime: result.modifiedTime }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not back up the document to Google Drive.'
      await db.files.update(file.id, { syncStatus: 'failed', syncError: message })
      return { success: false, error: message }
    }
  })
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function safeXlsxName(name: string) {
  return `${name.replace(/\.xlsx$/i, '').trim() || 'Untitled spreadsheet'}.xlsx`
}

async function uploadXlsxBlob(name: string, blob: Blob, parentId: string, fileId?: string | null, targetMimeType = XLSX_MIME) {
  const accessToken = useAuthStore.getState().getAccessToken()
  if (!accessToken) throw new Error('Your Google session expired. Please sign in again.')
  const metadata = {
    name: targetMimeType === GOOGLE_SHEET_MIME ? name.replace(/\.xlsx$/i, '').trim() || 'Untitled spreadsheet' : safeXlsxName(name),
    ...(fileId ? {} : { parents: [parentId] }),
    mimeType: targetMimeType,
  }
  const boundary = 'mybook-xlsx-boundary'
  const method = fileId ? 'PATCH' : 'POST'
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime'
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
  return await response.json() as { id: string; name: string; webViewLink?: string; modifiedTime?: string }
}

export async function backupSpreadsheetToDrive(input: {
  fileId: string
  title: string
  content: string
  folderId: string | null
}): Promise<DriveSetupResult> {
  return runSingleFileBackup(input.fileId, async () => {
    const file = await db.files.get(input.fileId)
    if (!file) return { success: false, error: 'Spreadsheet could not be found.' }
    const driveBootstrap = await ensureMyBookDriveFolder()
    if (!driveBootstrap.success) return { success: false, error: driveBootstrap.error }
    const parentFolder = input.folderId ? await db.folders.get(input.folderId) : null
    const driveParentId = parentFolder?.driveFolderId ?? driveBootstrap.folderId
    try {
      await db.files.update(file.id, { syncStatus: 'backing-up', syncError: null })
      const latest = await db.files.get(input.fileId)
      const { exportWorkbookToXlsx } = await import('../utils/xlsx')
      const snapshot = JSON.parse((latest?.content ?? input.content) || '{}')
      const exported = await exportWorkbookToXlsx(snapshot)
      if (!exported.success || !exported.data) throw new Error(exported.error ?? 'Could not convert the spreadsheet to XLSX.')
      const result = await retryWithBackoff(() => uploadXlsxBlob(latest?.name ?? input.title, exported.data as Blob, driveParentId, latest?.driveFileId ?? file.driveFileId, latest?.mimeType === GOOGLE_SHEET_MIME ? GOOGLE_SHEET_MIME : undefined))
      await db.files.update(file.id, { driveFileId: result.id, syncStatus: 'backed-up', lastSyncedAt: result.modifiedTime ?? latest?.lastSyncedAt ?? file.lastSyncedAt ?? new Date().toISOString() })
      return { success: true, folderId: driveParentId, folderName: 'MyBook', created: !(latest?.driveFileId ?? file.driveFileId), modifiedTime: result.modifiedTime }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not back up the spreadsheet to Google Drive.'
      await db.files.update(file.id, { syncStatus: 'failed', syncError: message })
      return { success: false, error: message }
    }
  })
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
  if (missing.length) {
    const allFolders = await db.folders.toArray()
    const allFiles = await db.files.toArray()
    const fileById = new Map(allFiles.map((file) => [file.id, file]))
    const deletedFolderIds = new Set(missing.map((folder) => folder.id))
    let changed = true
    while (changed) {
      changed = false
      for (const folder of allFolders) {
        if (folder.parentId && deletedFolderIds.has(folder.parentId) && !deletedFolderIds.has(folder.id)) {
          deletedFolderIds.add(folder.id)
          changed = true
        }
      }
    }
    const now = new Date().toISOString()
    await db.transaction('rw', db.folders, db.files, db.syncQueue, async () => {
      await Promise.all([...deletedFolderIds].map((folderId) => db.folders.update(folderId, { isDeleted: true, updatedAt: now })))
      await db.files.filter((file) => Boolean(file.folderId && deletedFolderIds.has(file.folderId))).modify({ isDeleted: true, updatedAt: now })
      await db.syncQueue
        .filter((item) => item.status !== 'completed' && item.entityType === 'folder' && deletedFolderIds.has(item.entityId))
        .modify({ status: 'completed', errorMessage: 'Deleted in Google Drive.', updatedAt: now })
      await db.syncQueue
        .filter((item) => item.status !== 'completed' && item.entityType === 'file')
        .modify((item) => {
          const file = fileById.get(item.entityId)
          if (file?.folderId && deletedFolderIds.has(file.folderId)) {
            item.status = 'completed'
            item.errorMessage = 'Deleted in Google Drive.'
            item.updatedAt = now
          }
        })
    })
  }
}

function inferFileType(name: string, mimeType: string) {
  if (mimeType === GOOGLE_SHEET_MIME || mimeType.includes('spreadsheet') || /\.xlsx$/i.test(name)) return 'spreadsheet' as const
  return 'document' as const
}

function localFileName(name: string, type: 'document' | 'spreadsheet') {
  return type === 'spreadsheet'
    ? name.replace(/\.xlsx$/i, '')
    : name.replace(/\.docx$/i, '')
}

function normalizedTitle(value: string) {
  return value.replace(/\.(docx|xlsx)$/i, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function stripLeadingTitleEchoes(text: string, fileName: string) {
  const title = normalizedTitle(fileName)
  if (!title) return text
  const paragraphs = text.split(/\n{2,}/)
  let start = 0
  while (start < paragraphs.length && normalizedTitle(paragraphs[start] ?? '') === title) start += 1
  return paragraphs.slice(start).join('\n\n')
}

function textNode(text: string, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []): JSONContent[] {
  return text ? [{ type: 'text', text, ...(marks.length ? { marks } : {}) }] : []
}

function markForElement(element: Element, marks: Array<{ type: string; attrs?: Record<string, unknown> }>) {
  const tag = element.tagName.toLowerCase()
  if (tag === 'strong' || tag === 'b') return [...marks, { type: 'bold' }]
  if (tag === 'em' || tag === 'i') return [...marks, { type: 'italic' }]
  if (tag === 'u') return [...marks, { type: 'underline' }]
  if (tag === 's' || tag === 'strike' || tag === 'del') return [...marks, { type: 'strike' }]
  if (tag === 'a') {
    const href = element.getAttribute('href')
    return href ? [...marks, { type: 'link', attrs: { href } }] : marks
  }
  return marks
}

function inlineJson(node: Node, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []): JSONContent[] {
  if (node.nodeType === Node.TEXT_NODE) return textNode(node.textContent ?? '', marks)
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const element = node as Element
  if (element.tagName.toLowerCase() === 'br') return [{ type: 'hardBreak' }]
  const nextMarks = markForElement(element, marks)
  return [...element.childNodes].flatMap((child) => inlineJson(child, nextMarks))
}

function paragraphJson(element: Element): JSONContent {
  const content = [...element.childNodes].flatMap((child) => inlineJson(child))
  return { type: 'paragraph', ...(content.length ? { content } : {}) }
}

function listJson(element: Element, ordered: boolean): JSONContent {
  const items = [...element.children]
    .filter((child) => child.tagName.toLowerCase() === 'li')
    .map((child) => {
      const blocks = blockJson(child)
      return { type: 'listItem', content: blocks.length ? blocks : [paragraphJson(child)] }
    })
  return { type: ordered ? 'orderedList' : 'bulletList', content: items }
}

function tableJson(element: Element): JSONContent {
  const rows = [...element.querySelectorAll('tr')].map((row) => ({
    type: 'tableRow',
    content: [...row.children].filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase())).map((cell) => ({
      type: 'tableCell',
      content: [paragraphJson(cell)],
    })),
  })).filter((row) => row.content.length)
  return { type: 'table', content: rows }
}

function blockJson(node: Node): JSONContent[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim()
    return text ? [{ type: 'paragraph', content: textNode(text) }] : []
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const element = node as Element
  const tag = element.tagName.toLowerCase()
  if (tag === 'p') return [paragraphJson(element)]
  if (/^h[1-6]$/.test(tag)) return [{ type: 'heading', attrs: { level: Math.min(Number(tag.slice(1)), 3) }, content: inlineJson(element) }]
  if (tag === 'ul') return [listJson(element, false)]
  if (tag === 'ol') return [listJson(element, true)]
  if (tag === 'blockquote') return [{ type: 'blockquote', content: [...element.childNodes].flatMap((child) => blockJson(child)) }]
  if (tag === 'table') return [tableJson(element)]
  if (tag === 'hr') return [{ type: 'horizontalRule' }]
  if (tag === 'li') {
    const childBlocks = [...element.childNodes].flatMap((child) => blockJson(child))
    return childBlocks.length ? childBlocks : [paragraphJson(element)]
  }
  return [...element.childNodes].flatMap((child) => blockJson(child))
}

function stripLeadingTitleNodes(content: JSONContent[], fileName: string) {
  const title = normalizedTitle(fileName)
  if (!title) return content
  let start = 0
  while (start < content.length) {
    const node = content[start]
    if (node?.type !== 'paragraph' && node?.type !== 'heading') break
    const text = (node.content ?? []).map((child) => child.text ?? '').join('')
    if (normalizedTitle(text) !== title) break
    start += 1
  }
  return content.slice(start)
}

function tiptapDocFromHtml(html: string, fileName: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const content = stripLeadingTitleNodes([...document.body.childNodes].flatMap((child) => blockJson(child)), fileName)
  return JSON.stringify({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] })
}

function tiptapDocFromText(text: string) {
  const paragraphs = text.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)
  return JSON.stringify({
    type: 'doc',
    content: (paragraphs.length ? paragraphs : ['']).map((paragraph) => ({
      type: 'paragraph',
      content: paragraph ? [{ type: 'text', text: paragraph }] : undefined,
    })),
  })
}

async function readDriveFileAsLocalContent(file: DriveFile, localFileId: string) {
  if (file.mimeType === GOOGLE_DOC_MIME || file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.name)) {
    const blob = file.mimeType === GOOGLE_DOC_MIME
      ? await exportGoogleWorkspaceFile(file.id, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      : await getDriveFileBlob(file.id)
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() })
    return tiptapDocFromHtml(result.value, file.name)
  }
  if (file.mimeType === GOOGLE_SHEET_MIME || file.mimeType === XLSX_MIME || /\.xlsx$/i.test(file.name)) {
    const blob = file.mimeType === GOOGLE_SHEET_MIME
      ? await exportGoogleWorkspaceFile(file.id, XLSX_MIME)
      : await getDriveFileBlob(file.id)
    const { importXlsxToWorkbook } = await import('../utils/xlsx')
    const imported = await importXlsxToWorkbook({
      name: file.name,
      type: file.mimeType,
      size: blob.size,
      arrayBuffer: () => blob.arrayBuffer(),
    }, localFileId)
    if (!imported.success || !imported.data) throw new Error(imported.error ?? 'Could not import the Drive spreadsheet.')
    return JSON.stringify(imported.data)
  }
  return getDriveFileContent(file.id)
}

async function saveVersionBeforeDriveUpdate(existingId: string, driveModifiedTime: string | null) {
  const existing = await db.files.get(existingId)
  if (!existing?.content) return
  await db.fileVersions.add({
    id: crypto.randomUUID(),
    fileId: existing.id,
    source: 'local',
    content: existing.content,
    name: existing.name,
    mimeType: existing.mimeType,
    driveFileId: existing.driveFileId,
    driveModifiedTime,
    createdAt: new Date().toISOString(),
    label: 'Before Drive update',
  })
}

export async function importDriveFilesToLocal() {
  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) throw new Error(bootstrap.error)

  const localFolders = await db.folders.toArray()
  const localFiles = await db.files.toArray()
  const byDriveId = new Map(localFiles.filter((file) => file.driveFileId).map((file) => [file.driveFileId as string, file]))
  const byNameAndParent = new Map<string, typeof localFiles[number]>()
  for (const file of localFiles) {
    byNameAndParent.set(`${file.folderId ?? 'root'}:${file.name.toLowerCase()}`, file)
    byNameAndParent.set(`${file.folderId ?? 'root'}:${localFileName(file.name, file.type).toLowerCase()}`, file)
  }
  const folderByDriveId = new Map(localFolders.filter((folder) => folder.driveFolderId).map((folder) => [folder.driveFolderId as string, folder]))
  const seenDriveFileIds = new Set<string>()

  const syncFiles = async (parentDriveId: string, parentLocalId: string | null) => {
    const children = await listChildFiles(parentDriveId)
    for (const driveFile of children) {
      seenDriveFileIds.add(driveFile.id)
      const fileType = inferFileType(driveFile.name, driveFile.mimeType)
      const existing = byDriveId.get(driveFile.id)
        ?? byNameAndParent.get(`${parentLocalId ?? 'root'}:${driveFile.name.toLowerCase()}`)
        ?? byNameAndParent.get(`${parentLocalId ?? 'root'}:${localFileName(driveFile.name, fileType).toLowerCase()}`)
      const now = new Date().toISOString()
      const localId = existing?.id ?? crypto.randomUUID()
      const driveModifiedTime = driveFile.modifiedTime ?? now
      let content = ''
      try {
        content = await readDriveFileAsLocalContent(driveFile, localId)
      } catch {
        content = ''
      }
      if (existing) {
        const driveIsNewer = !existing.lastSyncedAt || new Date(driveModifiedTime).getTime() > new Date(existing.lastSyncedAt).getTime()
        const nextContent = driveIsNewer && content && content !== existing.content ? content : existing.content
        if (nextContent !== existing.content) await saveVersionBeforeDriveUpdate(existing.id, driveModifiedTime)
        await db.files.update(existing.id, {
          name: localFileName(driveFile.name, fileType),
          folderId: parentLocalId,
          driveFileId: driveFile.id,
          type: existing.type ?? fileType,
          mimeType: driveFile.mimeType || existing.mimeType,
          content: nextContent,
          updatedAt: now,
          lastSyncedAt: driveModifiedTime,
          syncStatus: 'backed-up',
          syncError: null,
          isDeleted: false,
        })
      } else {
        await db.files.add({
          id: localId,
          driveFileId: driveFile.id,
          name: localFileName(driveFile.name, fileType),
          type: fileType,
          folderId: parentLocalId,
          content,
          mimeType: driveFile.mimeType,
          createdAt: now,
          updatedAt: now,
          lastSyncedAt: driveModifiedTime,
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
  const missingFiles = localFiles.filter((file) => !file.isDeleted && file.driveFileId && !seenDriveFileIds.has(file.driveFileId))
  if (missingFiles.length) {
    const now = new Date().toISOString()
    const missingFileIds = new Set(missingFiles.map((file) => file.id))
    await db.transaction('rw', db.files, db.syncQueue, async () => {
      await Promise.all(missingFiles.map((file) => db.files.update(file.id, { isDeleted: true, updatedAt: now })))
      await db.syncQueue
        .filter((item) => item.status !== 'completed' && item.entityType === 'file' && missingFileIds.has(item.entityId))
        .modify({ status: 'completed', errorMessage: 'Deleted in Google Drive.', updatedAt: now })
    })
  }
}

export async function refreshDriveFileToLocal(fileId: string): Promise<{ updated: boolean; modifiedTime?: string; error?: string }> {
  const local = await db.files.get(fileId)
  if (!local?.driveFileId) return { updated: false }
  try {
    const status = await getDriveFileStatus(local.driveFileId)
    if (!status.exists) return { updated: false, error: status.error ?? 'Drive file was not found.' }
    const driveModifiedTime = status.modifiedTime ?? new Date().toISOString()
    const driveFile: DriveFile = {
      id: local.driveFileId,
      name: local.name,
      mimeType: local.type === 'spreadsheet' ? XLSX_MIME : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      modifiedTime: driveModifiedTime,
    }
    const content = await readDriveFileAsLocalContent(driveFile, local.id)
    if (!content || content === local.content) {
      await db.files.update(local.id, { lastSyncedAt: driveModifiedTime, syncStatus: 'backed-up', syncError: null })
      return { updated: false, modifiedTime: driveModifiedTime }
    }
    await saveVersionBeforeDriveUpdate(local.id, driveModifiedTime)
    await db.files.update(local.id, {
      content,
      lastSyncedAt: driveModifiedTime,
      syncStatus: 'backed-up',
      syncError: null,
      updatedAt: new Date().toISOString(),
    })
    return { updated: true, modifiedTime: driveModifiedTime }
  } catch (error) {
    return { updated: false, error: error instanceof Error ? error.message : 'Could not refresh the Drive file.' }
  }
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
