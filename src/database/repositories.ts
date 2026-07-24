import { db } from './db'
import type { AppSetting, FileType, MyBookFile, MyBookFolder, SyncQueueItem } from '../types/files'
import { createDriveFileInFolder, ensureMyBookDriveFolder, ensureVisibleFolderInParent, trashDriveFile, updateDriveFile } from '../services/googleDrive'

export interface RepositoryResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

function failure(error: unknown, fallback: string): RepositoryResult<never> {
  console.error(fallback, error)
  return { success: false, error: error instanceof Error ? error.message : fallback }
}

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
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
      const parentFolder = folderId ? await db.folders.get(folderId) : null
      const driveBootstrap = await ensureMyBookDriveFolder()
      const driveParentId = parentFolder?.driveFolderId ?? (driveBootstrap.success ? driveBootstrap.folderId : null)
      if (driveParentId) {
        try {
          const created = await createDriveFileInFolder(file.name, file.content, file.mimeType, driveParentId)
          file.driveFileId = created.id
          file.syncStatus = 'backed-up'
          file.lastSyncedAt = now
        } catch (error) {
          console.warn('Could not create the file in Google Drive yet.', error)
          file.syncStatus = navigator.onLine ? 'pending' : 'offline'
        }
      }
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
      if (existing.driveFileId && (changes.name !== undefined || changes.content !== undefined || changes.folderId !== undefined)) {
        try {
          await updateDriveFile(existing.driveFileId, {
            name: changes.name,
            content: changes.content,
            parentId: changes.folderId,
            mimeType: existing.mimeType,
          })
        } catch (error) {
          console.warn('Could not update the file in Google Drive yet.', error)
        }
      }
      await db.files.update(id, { ...changes, updatedAt: new Date().toISOString() })
      return { success: true }
    } catch (error) { return failure(error, 'Could not update file.') }
  },
  async delete(id: string) {
    const file = await db.files.get(id)
    if (file?.driveFileId) {
      try { await trashDriveFile(file.driveFileId) } catch (error) { console.warn('Could not trash the file in Google Drive yet.', error) }
    }
    return this.update(id, { isDeleted: true })
  },
  async restore(id: string) { return this.update(id, { isDeleted: false }) },
  async permanentlyDelete(id: string): Promise<RepositoryResult> { try { await db.files.delete(id); return { success: true } } catch (error) { return failure(error, 'Could not permanently delete file.') } },
  async list(includeDeleted = false): Promise<MyBookFile[]> { try { return await db.files.filter((file) => includeDeleted || !file.isDeleted).toArray() } catch (error) { console.error('Could not list files.', error); return [] } },
  async search(query: string): Promise<MyBookFile[]> { try { const value = query.trim().toLocaleLowerCase(); return await db.files.filter((file) => !file.isDeleted && file.name.toLocaleLowerCase().includes(value)).toArray() } catch (error) { console.error('Could not search files.', error); return [] } },
  async duplicate(id: string): Promise<RepositoryResult<MyBookFile>> {
    try {
      const source = await db.files.get(id)
      if (!source) return { success: false, error: 'File could not be found.' }
      const now = new Date().toISOString()
      const copy = { ...source, id: crypto.randomUUID(), driveFileId: null, name: `${source.name} copy`, createdAt: now, updatedAt: now, lastSyncedAt: null, syncStatus: 'pending' as const, isDeleted: false }
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
          console.warn('Could not create the folder in Google Drive yet.', error)
        }
      }
      await db.folders.add(folder)
      return { success: true, data: folder }
    } catch (error) { return failure(error, 'Could not create folder.') }
  },
  async get(id: string) { try { return { success: true, data: await db.folders.get(id) } } catch (error) { return failure(error, 'Could not load folder.') } },
  async update(id: string, changes: Partial<Omit<MyBookFolder, 'id'>>): Promise<RepositoryResult> {
    try {
      const folder = await db.folders.get(id); if (!folder) return { success: false, error: 'Folder could not be found.' }
      if (changes.name !== undefined) { const name = cleanName(changes.name); if (!name) return { success: false, error: 'Folder name cannot be empty.' }; const siblings = await db.folders.filter((item) => !item.isDeleted && item.id !== id && item.parentId === folder.parentId).toArray(); if (siblings.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return { success: false, error: 'A folder with this name already exists here.' }; changes = { ...changes, name } }
      await db.folders.update(id, { ...changes, updatedAt: new Date().toISOString() }); return { success: true }
    } catch (error) { return failure(error, 'Could not update folder.') }
  },
  async delete(id: string): Promise<RepositoryResult> {
    try {
      await db.transaction('rw', db.folders, db.files, async () => {
        const allFolders = await db.folders.toArray()
        const ids = new Set([id]); let changed = true
        while (changed) { changed = false; allFolders.forEach((folder) => { if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); changed = true } }) }
        const now = new Date().toISOString()
        await Promise.all([...ids].map((folderId) => db.folders.update(folderId, { isDeleted: true, updatedAt: now })))
        await db.files.filter((file) => Boolean(file.folderId && ids.has(file.folderId))).modify({ isDeleted: true, updatedAt: now })
      })
      return { success: true }
    } catch (error) { return failure(error, 'Could not delete folder.') }
  },
  async restore(id: string) { return this.update(id, { isDeleted: false }) },
  async list(): Promise<MyBookFolder[]> { try { return await db.folders.filter((folder) => !folder.isDeleted).toArray() } catch (error) { console.error('Could not list folders.', error); return [] } },
  async search(query: string): Promise<MyBookFolder[]> { try { const value = query.trim().toLocaleLowerCase(); return await db.folders.filter((folder) => !folder.isDeleted && folder.name.toLocaleLowerCase().includes(value)).toArray() } catch (error) { console.error('Could not search folders.', error); return [] } },
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
