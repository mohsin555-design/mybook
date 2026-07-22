export type FileType = 'document' | 'spreadsheet'
export type SyncStatus = 'pending' | 'backing-up' | 'backed-up' | 'failed' | 'offline'
export type EditorSaveStatus = 'editing' | 'saving-locally' | 'saved-locally' | SyncStatus
export type FileSort = 'recent' | 'name-asc' | 'name-desc' | 'type' | 'oldest'
export type FileFilter = 'all' | 'document' | 'spreadsheet'

export interface MyBookFile {
  id: string
  driveFileId: string | null
  name: string
  type: FileType
  folderId: string | null
  content: string
  mimeType: string
  createdAt: string
  updatedAt: string
  lastSyncedAt: string | null
  syncStatus: SyncStatus
  isDeleted: boolean
}

export interface MyBookFolder {
  id: string
  driveFolderId: string | null
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export type SyncEntityType = 'file' | 'folder'
export type SyncOperation = 'create' | 'update' | 'delete' | 'restore'
export type SyncQueueStatus = 'pending' | 'processing' | 'failed' | 'completed'

export interface SyncQueueItem {
  id: string
  entityId: string
  entityType: SyncEntityType
  operation: SyncOperation
  status: SyncQueueStatus
  retryCount: number
  createdAt: string
  updatedAt: string
  errorMessage: string | null
}

export interface AppSetting {
  key: string
  value: unknown
  updatedAt: string
}
