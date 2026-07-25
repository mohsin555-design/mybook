import { db } from './db'
import type { AppSetting, FileType, MyBookFile, MyBookFolder, SyncOperation, SyncQueueItem } from '../types/files'
import { ensureMyBookDriveFolder, ensureVisibleFolderInParent, restoreDriveFile, restoreDriveFolder, trashDriveFile, trashDriveFolder, updateDriveFile, updateDriveFolder } from '../services/googleDrive'
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
    await db.syncQueue.update(existing.id, { operation, status: 'pending', retryCount: existing.retryCount, errorMessage, updatedAt: now })
    return
  }
  await db.syncQueue.add({ id: crypto.randomUUID(), entityId: folderId, entityType: 'folder', operation, status: 'pending', retryCount: 0, createdAt: now, updatedAt: now, errorMessage })
}

export async function processPendingDriveFolderSync() {
  if (!navigator.onLine) return
  const queue = await db.syncQueue.filter((item) => item.entityType === 'folder' && item.status !== 'completed').sortBy('createdAt')
  for (const item of queue) {
    const folder = await db.folders.get(item.entityId)
    if (!folder) { await db.syncQueue.delete(item.id); continue }
    try {
      await db.syncQueue.update(item.id, { status: 'processing', updatedAt: new Date().toISOString() })
      if (item.operation === 'create' && !folder.driveFolderId && !folder.isDeleted) {
        const bootstrap = await ensureMyBookDriveFolder()
        if (!bootstrap.success) throw new Error(bootstrap.error)
        const parent = folder.parentId ? await db.folders.get(folder.parentId) : null
        const driveParentId = parent?.driveFolderId ?? bootstrap.folderId
        const driveFolder = await ensureVisibleFolderInParent(folder.name, driveParentId)
        await db.folders.update(folder.id, { driveFolderId: driveFolder.id, updatedAt: new Date().toISOString() })
      } else if (folder.driveFolderId && item.operation === 'update') {
        const parent = folder.parentId ? await db.folders.get(folder.parentId) : null
        const bootstrap = !folder.parentId ? await ensureMyBookDriveFolder() : null
        const driveParentId = folder.parentId ? parent?.driveFolderId ?? null : bootstrap?.success ? bootstrap.folderId : null
        await updateDriveFolder(folder.driveFolderId, { name: folder.name, parentId: driveParentId })
      } else if (folder.driveFolderId && item.operation === 'delete') await trashDriveFolder(folder.driveFolderId)
      else if (folder.driveFolderId && item.operation === 'restore') await restoreDriveFolder(folder.driveFolderId)
      await db.syncQueue.update(item.id, { status: 'completed', errorMessage: null, updatedAt: new Date().toISOString() })
    } catch (error) {
      await db.syncQueue.update(item.id, { status: 'failed', retryCount: item.retryCount + 1, errorMessage: error instanceof Error ? error.message : 'Google Drive folder sync failed.', updatedAt: new Date().toISOString() })
    }
  }
}

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
      return { success: true, data: file }
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
      if (existing.driveFileId && (changes.name !== undefined || changes.folderId !== undefined || (changes.content !== undefined && existing.type !== 'spreadsheet'))) {
        try {
          const targetFolder = changes.folderId !== undefined && changes.folderId
            ? await db.folders.get(changes.folderId)
            : null
          const driveBootstrap = changes.folderId !== undefined && !targetFolder
            ? await ensureMyBookDriveFolder()
            : null
          const driveParentId = changes.folderId === undefined
            ? undefined
            : targetFolder?.driveFolderId ?? (driveBootstrap?.success ? driveBootstrap.folderId : null)
          const driveName = changes.name === undefined ? undefined : existing.type === 'spreadsheet'
            ? `${changes.name.replace(/\.xlsx$/i, '')}.xlsx`
            : `${changes.name.replace(/\.docx$/i, '')}.docx`
          if (changes.content !== undefined && existing.type !== 'spreadsheet') await updateDriveFile(existing.driveFileId, { name: driveName, content: changes.content, parentId: driveParentId, mimeType: existing.mimeType })
          else await updateDriveFile(existing.driveFileId, { name: driveName, parentId: driveParentId })
        } catch (error) {
          devLog('warn', 'Could not update the file in Google Drive yet.', error)
        }
      }
      await db.files.update(id, { ...changes, updatedAt: new Date().toISOString() })
      return { success: true }
    } catch (error) { return failure(error, 'Could not update file.') }
  },
  async delete(id: string) {
    const file = await db.files.get(id)
    if (file?.driveFileId) {
      try { await trashDriveFile(file.driveFileId) } catch (error) { devLog('warn', 'Could not trash the file in Google Drive yet.', error) }
    }
    return this.update(id, { isDeleted: true })
  },
  async restore(id: string) {
    try {
      const file = await db.files.get(id)
      if (file?.driveFileId) {
        try { await restoreDriveFile(file.driveFileId) } catch (error) { devLog('warn', 'Could not restore the file in Google Drive yet.', error) }
      }
      return this.update(id, { isDeleted: false })
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
      return { success: true, data: copy }
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
      const driveBootstrap = await ensureMyBookDriveFolder()
      const driveParentId = parentId
        ? (await db.folders.get(parentId))?.driveFolderId ?? (driveBootstrap.success ? driveBootstrap.folderId : null)
        : (driveBootstrap.success ? driveBootstrap.folderId : null)
      if (driveParentId) {
        try {
          const driveFolder = await ensureVisibleFolderInParent(normalized, driveParentId)
          folder.driveFolderId = driveFolder.id
        } catch (error) {
          devLog('warn', 'Could not create the folder in Google Drive yet.', error)
        }
      }
      await db.folders.add(folder)
      if (!folder.driveFolderId) {
        await queueFolderSync(folder.id, 'create', navigator.onLine ? 'Google Drive folder is pending.' : 'Offline. Folder will sync when you reconnect.')
        if (navigator.onLine) await processPendingDriveFolderSync()
      }
      return { success: true, data: folder }
    } catch (error) { return failure(error, 'Could not create folder.') }
  },
  async get(id: string) { try { return { success: true, data: await db.folders.get(id) } } catch (error) { return failure(error, 'Could not load folder.') } },
  async update(id: string, changes: Partial<Omit<MyBookFolder, 'id'>>): Promise<RepositoryResult> {
    try {
      const folder = await db.folders.get(id); if (!folder) return { success: false, error: 'Folder could not be found.' }
      if (changes.name !== undefined) { const name = cleanName(changes.name); if (!name) return { success: false, error: 'Folder name cannot be empty.' }; const siblings = await db.folders.filter((item) => !item.isDeleted && item.id !== id && item.parentId === folder.parentId).toArray(); if (siblings.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return { success: false, error: 'A folder with this name already exists here.' }; changes = { ...changes, name } }
      const next = { ...changes, updatedAt: new Date().toISOString() }
      await db.folders.update(id, next)
      if (folder.driveFolderId && (changes.name !== undefined || changes.parentId !== undefined)) {
        if (navigator.onLine) {
          try {
            const updated = await db.folders.get(id)
            const parent = updated?.parentId ? await db.folders.get(updated.parentId) : null
            const bootstrap = updated?.parentId ? null : await ensureMyBookDriveFolder()
            const driveParentId = updated?.parentId ? parent?.driveFolderId ?? null : bootstrap?.success ? bootstrap.folderId : null
            await updateDriveFolder(folder.driveFolderId, { name: updated?.name, parentId: driveParentId })
          } catch (error) {
            await queueFolderSync(id, 'update', error instanceof Error ? error.message : 'Could not update the Google Drive folder.')
            await processPendingDriveFolderSync()
          }
        } else {
          await queueFolderSync(id, 'update', 'Offline. Folder changes will sync when you reconnect.')
          if (navigator.onLine) await processPendingDriveFolderSync()
        }
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
    if (result.success && folder?.driveFolderId) {
      await queueFolderSync(id, 'restore', navigator.onLine ? null : 'Offline. Folder restore will sync when you reconnect.')
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
