import { db } from './db'
import type { AppSetting, FileType, FileVersionSource, MyBookFile, MyBookFolder, SyncOperation, SyncQueueItem } from '../types/files'
import { backupDocumentToDrive, backupSpreadsheetToDrive, ensureMyBookDriveFolder, ensureVisibleFolderInParent, restoreDriveFile, restoreDriveFolder, trashDriveFile, trashDriveFolder, updateDriveFolder } from '../services/googleDrive'
import { devLog } from '../utils/safeLog'

export interface RepositoryResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

function failure(error: unknown, fallback: string): RepositoryResult<never> {
  devLog('error', fallback, error)
  return { success: false, error: error instanceof Error ? error.message : fallback }
}

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

async function queueFolderSync(folderId: string, operation: SyncOperation, errorMessage: string | null = null) {
  const existing = await db.syncQueue.filter((item) => item.entityType === 'folder' && item.entityId === folderId && item.status !== 'completed').first()
  const now = new Date().toISOString()
  if (existing) {
    const nextOperation = existing.operation === 'create' && operation === 'update' ? 'create' : operation
    await db.syncQueue.update(existing.id, { operation: nextOperation, status: 'pending', retryCount: existing.retryCount, errorMessage, updatedAt: now })
    return
  }
  await db.syncQueue.add({ id: crypto.randomUUID(), entityId: folderId, entityType: 'folder', operation, status: 'pending', retryCount: 0, createdAt: now, updatedAt: now, errorMessage })
}

async function queueFileSync(fileId: string, operation: SyncOperation, errorMessage: string | null = null) {
  const existing = await db.syncQueue.filter((item) => item.entityType === 'file' && item.entityId === fileId && item.status !== 'completed').first()
  const now = new Date().toISOString()
  if (existing) {
    const nextOperation = existing.operation === 'create' && operation === 'update' ? 'create' : operation
    await db.syncQueue.update(existing.id, { operation: nextOperation, status: 'pending', errorMessage, updatedAt: now })
    return
  }
  await db.syncQueue.add({ id: crypto.randomUUID(), entityId: fileId, entityType: 'file', operation, status: 'pending', retryCount: 0, createdAt: now, updatedAt: now, errorMessage })
}

async function ensureLocalFolderOnDrive(folderId: string | null, visiting = new Set<string>()): Promise<string> {
  const bootstrap = await ensureMyBookDriveFolder()
  if (!bootstrap.success) throw new Error(bootstrap.error)
  if (!folderId) return bootstrap.folderId
  if (visiting.has(folderId)) throw new Error('A folder cannot be moved inside itself.')
  const folder = await db.folders.get(folderId)
  if (!folder || folder.isDeleted) throw new Error('The destination folder could not be found.')
  if (folder.driveFolderId) return folder.driveFolderId
  visiting.add(folderId)
  const parentDriveId = await ensureLocalFolderOnDrive(folder.parentId, visiting)
  const driveFolder = await ensureVisibleFolderInParent(folder.name, parentDriveId)
  await db.folders.update(folder.id, { driveFolderId: driveFolder.id, updatedAt: new Date().toISOString() })
  visiting.delete(folderId)
  return driveFolder.id
}

export async function saveFileVersion(file: MyBookFile, source: FileVersionSource, label: string, driveModifiedTime: string | null = null) {
  if (!file.content) return
  await db.fileVersions.add({
    id: crypto.randomUUID(),
    fileId: file.id,
    source,
    content: file.content,
    name: file.name,
    mimeType: file.mimeType,
    driveFileId: file.driveFileId,
    driveModifiedTime,
    createdAt: new Date().toISOString(),
    label,
  })
}

async function syncFileItem(item: SyncQueueItem) {
  const file = await db.files.get(item.entityId)
  if (!file) { await db.syncQueue.delete(item.id); return }
  if (item.operation === 'delete') {
    if (file.driveFileId) await trashDriveFile(file.driveFileId)
    return
  }
  if (item.operation === 'restore' && file.driveFileId) {
    await restoreDriveFile(file.driveFileId)
    return
  }

  await ensureLocalFolderOnDrive(file.folderId)
  if (file.isDeleted) return
  const result = file.type === 'spreadsheet'
    ? await backupSpreadsheetToDrive({ fileId: file.id, title: file.name, content: file.content, folderId: file.folderId })
    : await backupDocumentToDrive({ fileId: file.id, title: file.name, content: file.content, folderId: file.folderId })
  if (!result.success) throw new Error(result.error)
  await db.files.update(file.id, { syncError: null, syncStatus: 'backed-up' })
}

export async function processPendingDriveSync() {
  if (!navigator.onLine) return
  const queue = await db.syncQueue.filter((item) => item.status !== 'completed').sortBy('createdAt')
  for (const item of queue) {
    if (item.entityType === 'file') {
      try {
        await db.syncQueue.update(item.id, { status: 'processing', updatedAt: new Date().toISOString() })
        await syncFileItem(item)
        await db.syncQueue.update(item.id, { status: 'completed', errorMessage: null, updatedAt: new Date().toISOString() })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Drive file sync failed.'
        await db.files.update(item.entityId, { syncStatus: 'failed', syncError: message })
        await db.syncQueue.update(item.id, { status: 'failed', retryCount: item.retryCount + 1, errorMessage: message, updatedAt: new Date().toISOString() })
      }
      continue
    }
    const folder = await db.folders.get(item.entityId)
    if (!folder) { await db.syncQueue.delete(item.id); continue }
    try {
      await db.syncQueue.update(item.id, { status: 'processing', updatedAt: new Date().toISOString() })
      if (item.operation === 'create' && !folder.driveFolderId && !folder.isDeleted) {
        await ensureLocalFolderOnDrive(folder.id)
      } else if (folder.driveFolderId && item.operation === 'update') {
        const driveParentId = await ensureLocalFolderOnDrive(folder.parentId)
        await updateDriveFolder(folder.driveFolderId, { name: folder.name, parentId: driveParentId })
      } else if (folder.driveFolderId && item.operation === 'delete') await trashDriveFolder(folder.driveFolderId)
      else if (folder.driveFolderId && item.operation === 'restore') await restoreDriveFolder(folder.driveFolderId)
      await db.syncQueue.update(item.id, { status: 'completed', errorMessage: null, updatedAt: new Date().toISOString() })
    } catch (error) {
      await db.syncQueue.update(item.id, { status: 'failed', retryCount: item.retryCount + 1, errorMessage: error instanceof Error ? error.message : 'Google Drive folder sync failed.', updatedAt: new Date().toISOString() })
    }
  }
}

export const processPendingDriveFolderSync = processPendingDriveSync

async function uniqueFileName(name: string, folderId: string | null, excludedId?: string) {
  const files = await db.files.filter((file) => file.folderId === folderId).toArray()
  return !files.some((file) => file.id !== excludedId && !file.isDeleted && file.folderId === folderId && file.name.toLocaleLowerCase() === name.toLocaleLowerCase())
}

export const fileRepository = {
  async create(type: FileType, folderId: string | null = null): Promise<RepositoryResult<MyBookFile>> {
    try {
      const now = new Date().toISOString()
      const file: MyBookFile = { id: crypto.randomUUID(), driveFileId: null, name: type === 'document' ? 'Untitled document' : 'Untitled spreadsheet', type, folderId, content: '', mimeType: type === 'document' ? 'application/x-mybook-document' : 'application/x-mybook-spreadsheet', createdAt: now, updatedAt: now, lastSyncedAt: null, syncStatus: 'pending', isDeleted: false }
      await db.files.add(file)
      await queueFileSync(file.id, 'create', navigator.onLine ? null : 'Offline. File will sync when you reconnect.')
      if (navigator.onLine) await processPendingDriveSync()
      const synced = await db.files.get(file.id)
      return { success: true, data: synced ?? file }
    } catch (error) { return failure(error, 'Could not create file.') }
  },
  async get(id: string) { try { return { success: true, data: await db.files.get(id) } } catch (error) { return failure(error, 'Could not load file.') } },
  async update(id: string, changes: Partial<Omit<MyBookFile, 'id'>>): Promise<RepositoryResult> {
    try {
      const existing = await db.files.get(id)
      if (!existing) return { success: false, error: 'File could not be found.' }
      if (changes.content !== undefined && changes.content === existing.content && Object.keys(changes).every((key) => key === 'content')) return { success: true }
      if (changes.name !== undefined) {
        const name = cleanName(changes.name)
        if (!name) return { success: false, error: 'File name cannot be empty.' }
        const file = await db.files.get(id)
        if (!file) return { success: false, error: 'File could not be found.' }
        if (!(await uniqueFileName(name, changes.folderId ?? file.folderId, id))) return { success: false, error: 'A file with this name already exists here.' }
        changes = { ...changes, name }
      }
      await db.files.update(id, { ...changes, updatedAt: new Date().toISOString() })
      if (changes.name !== undefined || changes.folderId !== undefined || changes.content !== undefined) {
        await queueFileSync(id, existing.driveFileId ? 'update' : 'create', navigator.onLine ? null : 'Offline. File changes will sync when you reconnect.')
        if (navigator.onLine) await processPendingDriveSync()
      }
      return { success: true }
    } catch (error) { return failure(error, 'Could not update file.') }
  },
  async delete(id: string) {
    try {
      const file = await db.files.get(id)
      if (!file) return { success: false, error: 'File could not be found.' }
      await db.files.update(id, { isDeleted: true, updatedAt: new Date().toISOString() })
      await queueFileSync(id, 'delete', navigator.onLine ? null : 'Offline. File will move to Drive Trash when you reconnect.')
      if (navigator.onLine) await processPendingDriveSync()
      return { success: true }
    } catch (error) { return failure(error, 'Could not delete file.') }
  },
  async restore(id: string) {
    try {
      const file = await db.files.get(id)
      if (!file) return { success: false, error: 'File could not be found.' }
      await db.files.update(id, { isDeleted: false, updatedAt: new Date().toISOString() })
      await queueFileSync(id, file.driveFileId ? 'restore' : 'create', navigator.onLine ? null : 'Offline. File restore will sync when you reconnect.')
      if (navigator.onLine) await processPendingDriveSync()
      return { success: true }
    } catch (error) { return failure(error, 'Could not restore file.') }
  },
  async permanentlyDelete(id: string): Promise<RepositoryResult> { try { await db.files.delete(id); return { success: true } } catch (error) { return failure(error, 'Could not permanently delete file.') } },
  async list(includeDeleted = false): Promise<MyBookFile[]> { try { return await db.files.filter((file) => includeDeleted || !file.isDeleted).toArray() } catch (error) { devLog('error', 'Could not list files.', error); return [] } },
  async search(query: string): Promise<MyBookFile[]> { try { const value = query.trim().toLocaleLowerCase(); return await db.files.filter((file) => !file.isDeleted && file.name.toLocaleLowerCase().includes(value)).toArray() } catch (error) { devLog('error', 'Could not search files.', error); return [] } },
  async duplicate(id: string): Promise<RepositoryResult<MyBookFile>> {
    try {
      const source = await db.files.get(id)
      if (!source) return { success: false, error: 'File could not be found.' }
      const now = new Date().toISOString()
      let copyName = `${source.name} copy`
      let suffix = 2
      while (!(await uniqueFileName(copyName, source.folderId))) copyName = `${source.name} copy ${suffix++}`
      const copy = { ...source, id: crypto.randomUUID(), driveFileId: null, name: copyName, createdAt: now, updatedAt: now, lastSyncedAt: null, syncStatus: 'pending' as const, isDeleted: false }
      await db.files.add(copy)
      await queueFileSync(copy.id, 'create', navigator.onLine ? null : 'Offline. File copy will sync when you reconnect.')
      if (navigator.onLine) await processPendingDriveSync()
      return { success: true, data: (await db.files.get(copy.id)) ?? copy }
    } catch (error) { return failure(error, 'Could not duplicate file.') }
  },
}

export const folderRepository = {
  async create(name: string, parentId: string | null = null): Promise<RepositoryResult<MyBookFolder>> {
    try {
      const normalized = cleanName(name)
      if (!normalized) return { success: false, error: 'Folder name cannot be empty.' }
      const siblings = await db.folders.filter((folder) => !folder.isDeleted && folder.parentId === parentId).toArray()
      if (siblings.some((folder) => folder.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) return { success: false, error: 'A folder with this name already exists here.' }
      let depth = 1
      let ancestorId = parentId
      while (ancestorId) {
        depth += 1
        ancestorId = (await db.folders.get(ancestorId))?.parentId ?? null
      }
      if (depth > 3) return { success: false, error: 'Folders can be nested up to three levels.' }
      const now = new Date().toISOString()
      const folder: MyBookFolder = { id: crypto.randomUUID(), driveFolderId: null, name: normalized, parentId, createdAt: now, updatedAt: now, isDeleted: false }
      await db.folders.add(folder)
      await queueFolderSync(folder.id, 'create', navigator.onLine ? null : 'Offline. Folder will sync when you reconnect.')
      if (navigator.onLine) await processPendingDriveSync()
      return { success: true, data: (await db.folders.get(folder.id)) ?? folder }
    } catch (error) { return failure(error, 'Could not create folder.') }
  },
  async get(id: string) { try { return { success: true, data: await db.folders.get(id) } } catch (error) { return failure(error, 'Could not load folder.') } },
  async update(id: string, changes: Partial<Omit<MyBookFolder, 'id'>>): Promise<RepositoryResult> {
    try {
      const folder = await db.folders.get(id); if (!folder) return { success: false, error: 'Folder could not be found.' }
      const targetParentId = changes.parentId !== undefined ? changes.parentId : folder.parentId
      if (targetParentId === id) return { success: false, error: 'A folder cannot be moved inside itself.' }
      if (changes.parentId !== undefined) {
        const allFolders = await db.folders.toArray()
        const descendants = new Set<string>()
        let changed = true
        while (changed) {
          changed = false
          for (const candidate of allFolders) {
            if ((candidate.parentId === id || (candidate.parentId && descendants.has(candidate.parentId))) && !descendants.has(candidate.id)) {
              descendants.add(candidate.id); changed = true
            }
          }
        }
        if (targetParentId && descendants.has(targetParentId)) return { success: false, error: 'A folder cannot be moved into one of its subfolders.' }

        let targetDepth = 0
        let ancestorId = targetParentId
        while (ancestorId) { targetDepth += 1; ancestorId = (await db.folders.get(ancestorId))?.parentId ?? null }
        let subtreeDepth = 1
        for (const descendant of descendants) {
          let depth = 1
          let current = (await db.folders.get(descendant))?.parentId ?? null
          while (current && current !== id) { depth += 1; current = (await db.folders.get(current))?.parentId ?? null }
          subtreeDepth = Math.max(subtreeDepth, depth + 1)
        }
        if (targetDepth + subtreeDepth > 3) return { success: false, error: 'Folders can be nested up to three levels.' }
      }
      if (changes.name !== undefined) { const name = cleanName(changes.name); if (!name) return { success: false, error: 'Folder name cannot be empty.' }; changes = { ...changes, name } }
      const nextName = changes.name ?? folder.name
      const siblings = await db.folders.filter((item) => !item.isDeleted && item.id !== id && item.parentId === targetParentId).toArray()
      if (siblings.some((item) => item.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())) return { success: false, error: 'A folder with this name already exists here.' }
      const next = { ...changes, updatedAt: new Date().toISOString() }
      await db.folders.update(id, next)
      if (changes.name !== undefined || changes.parentId !== undefined) {
        await queueFolderSync(id, folder.driveFolderId ? 'update' : 'create', navigator.onLine ? null : 'Offline. Folder changes will sync when you reconnect.')
        if (navigator.onLine) await processPendingDriveSync()
      }
      return { success: true }
    } catch (error) { return failure(error, 'Could not update folder.') }
  },
  async delete(id: string): Promise<RepositoryResult> {
    try {
      let deletedFolderIds: string[] = []
      await db.transaction('rw', db.folders, db.files, async () => {
        const allFolders = await db.folders.toArray()
        const ids = new Set([id]); let changed = true
        while (changed) { changed = false; allFolders.forEach((folder) => { if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); changed = true } }) }
        deletedFolderIds = [...ids]
        const now = new Date().toISOString()
        await Promise.all([...ids].map((folderId) => db.folders.update(folderId, { isDeleted: true, updatedAt: now })))
        await db.files.filter((file) => Boolean(file.folderId && ids.has(file.folderId))).modify({ isDeleted: true, updatedAt: now })
      })
      await Promise.all(deletedFolderIds.map((folderId) => queueFolderSync(folderId, 'delete', navigator.onLine ? null : 'Offline. Folder will move to Drive Trash when you reconnect.')))
      if (navigator.onLine) await processPendingDriveFolderSync()
      return { success: true }
    } catch (error) { return failure(error, 'Could not delete folder.') }
  },
  async restore(id: string) {
    const result = await this.update(id, { isDeleted: false })
    const folder = await db.folders.get(id)
    if (result.success && folder) {
      await queueFolderSync(id, folder.driveFolderId ? 'restore' : 'create', navigator.onLine ? null : 'Offline. Folder restore will sync when you reconnect.')
      if (navigator.onLine) await processPendingDriveFolderSync()
    }
    return result
  },
  async list(): Promise<MyBookFolder[]> { try { return await db.folders.filter((folder) => !folder.isDeleted).toArray() } catch (error) { devLog('error', 'Could not list folders.', error); return [] } },
  async search(query: string): Promise<MyBookFolder[]> { try { const value = query.trim().toLocaleLowerCase(); return await db.folders.filter((folder) => !folder.isDeleted && folder.name.toLocaleLowerCase().includes(value)).toArray() } catch (error) { devLog('error', 'Could not search folders.', error); return [] } },
}

export const settingsRepository = {
  async create(setting: AppSetting) { try { await db.settings.add(setting); return { success: true } } catch (error) { return failure(error, 'Could not create setting.') } },
  async get(key: string) { try { return { success: true, data: await db.settings.get(key) } } catch (error) { return failure(error, 'Could not load setting.') } },
  async update(key: string, value: unknown) { try { await db.settings.put({ key, value, updatedAt: new Date().toISOString() }); return { success: true } } catch (error) { return failure(error, 'Could not update setting.') } },
  async delete(key: string) { try { await db.settings.delete(key); return { success: true } } catch (error) { return failure(error, 'Could not delete setting.') } },
  async restore() { return { success: false, error: 'Settings do not support restore.' } },
  async list() { return db.settings.toArray() }, async search(query: string) { return db.settings.filter((item) => item.key.includes(query)).toArray() },
}

export const syncQueueRepository = {
  async create(item: SyncQueueItem) { try { await db.syncQueue.add(item); return { success: true, data: item } } catch (error) { return failure(error, 'Could not queue sync operation.') } },
  async get(id: string) { try { return { success: true, data: await db.syncQueue.get(id) } } catch (error) { return failure(error, 'Could not load sync operation.') } },
  async update(id: string, changes: Partial<SyncQueueItem>) { try { await db.syncQueue.update(id, { ...changes, updatedAt: new Date().toISOString() }); return { success: true } } catch (error) { return failure(error, 'Could not update sync operation.') } },
  async delete(id: string) { try { await db.syncQueue.delete(id); return { success: true } } catch (error) { return failure(error, 'Could not delete sync operation.') } },
  async restore() { return { success: false, error: 'Sync queue items do not support restore.' } },
  async list() { return db.syncQueue.toArray() }, async search(query: string) { return db.syncQueue.filter((item) => item.entityId.includes(query)).toArray() },
}

export const fileVersionRepository = {
  async list(fileId: string) {
    try {
      return await db.fileVersions.where('fileId').equals(fileId).reverse().sortBy('createdAt')
    } catch (error) {
      devLog('error', 'Could not list file versions.', error)
      return []
    }
  },
  async restore(versionId: string): Promise<RepositoryResult<MyBookFile>> {
    try {
      const version = await db.fileVersions.get(versionId)
      if (!version) return { success: false, error: 'Version could not be found.' }
      const file = await db.files.get(version.fileId)
      if (!file) return { success: false, error: 'File could not be found.' }
      await saveFileVersion(file, 'local', 'Before version restore')
      await db.files.update(file.id, {
        content: version.content,
        name: version.name,
        mimeType: version.mimeType,
        syncStatus: 'pending',
        syncError: null,
        updatedAt: new Date().toISOString(),
      })
      await queueFileSync(file.id, file.driveFileId ? 'update' : 'create')
      if (navigator.onLine) await processPendingDriveSync()
      const restored = await db.files.get(file.id)
      return { success: true, data: restored }
    } catch (error) {
      return failure(error, 'Could not restore version.')
    }
  },
}
