import { db } from '../database/db'
import { writeLocalWorkspaceFile } from './localWorkspace'
import type { FileType, MyBookFile, MyBookFileVersion, MyBookFolder } from '../types/files'

const BACKUP_KIND = 'mybook-workspace-backup'
const BACKUP_VERSION = 1

interface MyBookBackup {
  kind: typeof BACKUP_KIND
  version: typeof BACKUP_VERSION
  exportedAt: string
  files: MyBookFile[]
  folders: MyBookFolder[]
  fileVersions: MyBookFileVersion[]
}

type NavigatorWithShare = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
}

function safeDateStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-')
}

function backupFileName() {
  return `writin-backup-${safeDateStamp()}.mybook-backup.json`
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function backupShareFiles(content: string, name: string) {
  return [
    new File([content], name, { type: 'application/json' }),
    new File([content], name, { type: 'text/plain' }),
    new File([content], name),
  ]
}

export async function exportLocalWorkspaceBackup() {
  const backup: MyBookBackup = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    folders: await db.folders.filter((folder) => !folder.isDeleted && folder.workspaceType === 'local').toArray(),
    files: await db.files.filter((file) => !file.isDeleted && (file.workspaceType === 'local' || (!file.workspaceType && file.syncStatus === 'local' && !file.driveFileId))).toArray(),
    fileVersions: await db.fileVersions.toArray(),
  }
  const name = backupFileName()
  const content = JSON.stringify(backup, null, 2)
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const shareNavigator = navigator as NavigatorWithShare

  if (shareNavigator.canShare && shareNavigator.share) {
    for (const file of backupShareFiles(content, name)) {
      if (!shareNavigator.canShare({ files: [file] })) continue
      await shareNavigator.share({ files: [file], title: 'Writin backup', text: 'Save this backup to Files or iCloud Drive.' })
      return { success: true as const, fileName: name, method: 'share' as const, mimeType: file.type || 'none' }
    }
  }

  downloadBlob(blob, name)
  return { success: true as const, fileName: name, method: 'download' as const }
}

function assertBackup(value: unknown): asserts value is MyBookBackup {
  if (!value || typeof value !== 'object') throw new Error('Backup file is not valid.')
  const backup = value as Partial<MyBookBackup>
  if (backup.kind !== BACKUP_KIND || backup.version !== BACKUP_VERSION) throw new Error('Backup file is not compatible with this app.')
  if (!Array.isArray(backup.files) || !Array.isArray(backup.folders) || !Array.isArray(backup.fileVersions)) throw new Error('Backup file is incomplete.')
}

function fileMimeType(type: FileType) {
  return type === 'document' ? 'application/x-mybook-document' : 'application/x-mybook-spreadsheet'
}

async function importedRootName(exportedAt: string) {
  const date = new Date(exportedAt)
  const baseName = `Imported backup ${Number.isNaN(date.getTime()) ? safeDateStamp() : date.toLocaleDateString()}`
  const rootFolders = await db.folders.filter((folder) => !folder.isDeleted && folder.parentId === null).toArray()
  if (!rootFolders.some((folder) => folder.name.toLocaleLowerCase() === baseName.toLocaleLowerCase())) return baseName
  let suffix = 2
  let name = `${baseName} ${suffix}`
  while (rootFolders.some((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    suffix += 1
    name = `${baseName} ${suffix}`
  }
  return name
}

export async function importLocalWorkspaceBackup(file: File) {
  const parsed = JSON.parse(await file.text()) as unknown
  assertBackup(parsed)

  const now = new Date().toISOString()
  const folderIdMap = new Map<string, string>()
  const fileIdMap = new Map<string, string>()
  const importRootId = crypto.randomUUID()
  const importRoot: MyBookFolder = {
    id: importRootId,
    driveFolderId: null,
    workspaceType: 'local',
    name: await importedRootName(parsed.exportedAt),
    parentId: null,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  }

  const sortedFolders = [...parsed.folders].sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)))
  for (const folder of sortedFolders) folderIdMap.set(folder.id, crypto.randomUUID())
  for (const source of parsed.files) fileIdMap.set(source.id, crypto.randomUUID())

  const folders: MyBookFolder[] = [
    importRoot,
    ...sortedFolders.map((folder) => ({
      ...folder,
      id: folderIdMap.get(folder.id) ?? crypto.randomUUID(),
      driveFolderId: null,
      workspaceType: 'local' as const,
      parentId: folder.parentId ? folderIdMap.get(folder.parentId) ?? importRootId : importRootId,
      isDeleted: false,
    })),
  ]
  const files: MyBookFile[] = parsed.files.map((file) => ({
    ...file,
    id: fileIdMap.get(file.id) ?? crypto.randomUUID(),
    driveFileId: null,
    workspaceType: 'local' as const,
    folderId: file.folderId ? folderIdMap.get(file.folderId) ?? importRootId : importRootId,
    mimeType: file.mimeType || fileMimeType(file.type),
    lastSyncedAt: null,
    syncError: null,
    syncStatus: 'local',
    isDeleted: false,
  }))
  const fileVersions: MyBookFileVersion[] = parsed.fileVersions
    .filter((version) => fileIdMap.has(version.fileId))
    .map((version) => ({
      ...version,
      id: crypto.randomUUID(),
      fileId: fileIdMap.get(version.fileId) ?? version.fileId,
      driveFileId: null,
      driveModifiedTime: null,
      source: 'local',
    }))

  await db.transaction('rw', db.folders, db.files, db.fileVersions, async () => {
    await db.folders.bulkAdd(folders)
    await db.files.bulkAdd(files)
    if (fileVersions.length) await db.fileVersions.bulkAdd(fileVersions)
  })
  await Promise.all(files.map((item) => writeLocalWorkspaceFile(item)))

  return { success: true as const, folderId: importRootId, fileCount: files.length, folderCount: folders.length - 1 }
}
