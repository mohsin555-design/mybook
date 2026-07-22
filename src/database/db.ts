import Dexie, { type EntityTable } from 'dexie'

import type { AppSetting, MyBookFile, MyBookFolder, SyncQueueItem } from '../types/files'

class MyBookDatabase extends Dexie {
  files!: EntityTable<MyBookFile, 'id'>
  folders!: EntityTable<MyBookFolder, 'id'>
  settings!: EntityTable<AppSetting, 'key'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>

  constructor() {
    super('mybook-db')
    this.version(1).stores({
      files: 'id, driveFileId, name, type, folderId, updatedAt, syncStatus, isDeleted',
      folders: 'id, driveFolderId, name, parentId, updatedAt, isDeleted',
      settings: 'key, updatedAt',
      syncQueue: 'id, entityId, entityType, operation, status, createdAt, updatedAt',
    })
  }
}

export const db = new MyBookDatabase()
