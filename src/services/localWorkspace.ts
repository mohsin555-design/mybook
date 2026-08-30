import type { JSONContent } from '@tiptap/core'

import { db } from '../database/db'
import type { MyBookFile } from '../types/files'
import { documentToMyBookMarkdown, myBookMarkdownToDocument } from '../utils/mybookMarkdown'
import { devLog } from '../utils/safeLog'

const ROOT_DIR = 'Writin'
const FILES_DIR = 'files'
const LOCAL_DIRECTORY_HANDLE_KEY = 'local-workspace.directory-handle'
const LOCAL_WORKSPACE_DETAILS_KEY = 'local-workspace.details'

type StorageNavigator = Navigator & {
  storage?: StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>
    persist?: () => Promise<boolean>
    persisted?: () => Promise<boolean>
    estimate?: () => Promise<StorageEstimate>
  }
}

type FileSystemWindow = Window & {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

type PermissionMode = 'read' | 'readwrite'
type PermissionDescriptor = { mode?: PermissionMode }
type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: PermissionDescriptor) => Promise<PermissionState>
  requestPermission?: (descriptor?: PermissionDescriptor) => Promise<PermissionState>
}
export type LocalWorkspaceStorageKind = 'file-system' | 'opfs' | 'indexeddb'
export type LocalWorkspaceStoragePreference = 'file-system' | 'private'

export interface LocalWorkspaceDetails {
  name: string
  storage: LocalWorkspaceStorageKind
  createdAt: string
}

export interface PickedLocalWorkspaceDirectory {
  handle: FileSystemDirectoryHandle
  name: string
}

function opfsRoot() {
  return (navigator as StorageNavigator).storage?.getDirectory
}

export function isOpfsAvailable() {
  return typeof opfsRoot() === 'function'
}

export async function requestPersistentLocalStorage() {
  return await (navigator as StorageNavigator).storage?.persist?.() ?? false
}

export async function getLocalStorageProtectionStatus() {
  const storage = (navigator as StorageNavigator).storage
  const [persisted, estimate] = await Promise.all([
    storage?.persisted?.() ?? Promise.resolve(false),
    storage?.estimate?.() ?? Promise.resolve({ usage: undefined, quota: undefined } as StorageEstimate),
  ])
  return {
    persisted,
    usage: estimate.usage,
    quota: estimate.quota,
  }
}

export function canPickDeviceDirectory() {
  return typeof (window as FileSystemWindow).showDirectoryPicker === 'function'
}

async function hasReadWritePermission(handle: FileSystemDirectoryHandle) {
  const permissioned = handle as PermissionedDirectoryHandle
  if (!permissioned.queryPermission || !permissioned.requestPermission) return true
  if (await permissioned.queryPermission({ mode: 'readwrite' }) === 'granted') return true
  return await permissioned.requestPermission({ mode: 'readwrite' }) === 'granted'
}

async function saveDeviceDirectoryHandle(handle: FileSystemDirectoryHandle) {
  await db.settings.put({ key: LOCAL_DIRECTORY_HANDLE_KEY, value: handle, updatedAt: new Date().toISOString() })
}

async function forgetDeviceDirectoryHandle() {
  await db.settings.delete(LOCAL_DIRECTORY_HANDLE_KEY)
}

async function saveLocalWorkspaceDetails(details: LocalWorkspaceDetails) {
  await db.settings.put({ key: LOCAL_WORKSPACE_DETAILS_KEY, value: details, updatedAt: new Date().toISOString() })
}

export async function pickLocalWorkspaceDirectory(): Promise<PickedLocalWorkspaceDirectory | null> {
  if (!canPickDeviceDirectory()) return null
  try {
    const handle = await (window as FileSystemWindow).showDirectoryPicker?.({
      id: 'writin-local-workspace',
      mode: 'readwrite',
    })
    if (!handle || !await hasReadWritePermission(handle)) return null
    return { handle, name: handle.name }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      devLog('warn', 'Could not pick a device folder workspace.', error)
    }
    return null
  }
}

async function getDeviceDirectoryHandle() {
  return (await db.settings.get(LOCAL_DIRECTORY_HANDLE_KEY))?.value as FileSystemDirectoryHandle | undefined
}

async function filesDirectory() {
  const deviceDirectory = await getDeviceDirectoryHandle()
  if (deviceDirectory && await hasReadWritePermission(deviceDirectory)) {
    const workspace = await deviceDirectory.getDirectoryHandle(ROOT_DIR, { create: true })
    return workspace.getDirectoryHandle(FILES_DIR, { create: true })
  }

  const getDirectory = opfsRoot()
  if (!getDirectory) return null
  const root = await getDirectory.call(navigator.storage)
  const workspace = await root.getDirectoryHandle(ROOT_DIR, { create: true })
  return workspace.getDirectoryHandle(FILES_DIR, { create: true })
}

function privateStorageKind(): LocalWorkspaceStorageKind {
  return isOpfsAvailable() ? 'opfs' : 'indexeddb'
}

export async function initializeLocalWorkspace({
  name = 'My Workspace',
  storagePreference = canPickDeviceDirectory() ? 'file-system' : 'private',
  allowPrivateFallback = true,
  directoryHandle,
}: {
  name?: string
  storagePreference?: LocalWorkspaceStoragePreference
  allowPrivateFallback?: boolean
  directoryHandle?: FileSystemDirectoryHandle | null
} = {}) {
  await requestPersistentLocalStorage()
  const createdAt = new Date().toISOString()
  if (storagePreference === 'private' || !canPickDeviceDirectory()) {
    await forgetDeviceDirectoryHandle()
    const storage = privateStorageKind()
    await saveLocalWorkspaceDetails({ name, storage, createdAt })
    return { storage }
  }

  try {
    const handle = directoryHandle ?? await (window as FileSystemWindow).showDirectoryPicker?.({
      id: 'writin-local-workspace',
      mode: 'readwrite',
    })
    if (!handle) {
      if (!allowPrivateFallback) return { storage: privateStorageKind(), cancelled: true }
      const storage = privateStorageKind()
      await saveLocalWorkspaceDetails({ name, storage, createdAt })
      return { storage }
    }
    if (await hasReadWritePermission(handle)) {
      await saveDeviceDirectoryHandle(handle)
      await filesDirectory()
      await saveLocalWorkspaceDetails({ name, storage: 'file-system', createdAt })
      return { storage: 'file-system' as const }
    }
  } catch (error) {
    if (!allowPrivateFallback && error instanceof DOMException && error.name === 'AbortError') {
      return { storage: privateStorageKind(), cancelled: true }
    }
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      devLog('warn', 'Could not initialize device folder workspace.', error)
    }
  }
  const storage = privateStorageKind()
  await saveLocalWorkspaceDetails({ name, storage, createdAt })
  return { storage }
}

function exactContentFileName(file: Pick<MyBookFile, 'id'>) {
  return `${file.id}.content.json`
}

function portableFileName(file: Pick<MyBookFile, 'id' | 'type'>) {
  return file.type === 'spreadsheet' ? `${file.id}.mybook.json` : `${file.id}.mybook.md`
}

function documentMarkdown(file: Pick<MyBookFile, 'name' | 'content'>) {
  try {
    return documentToMyBookMarkdown(file.name, JSON.parse(file.content) as JSONContent)
  } catch {
    return file.content
  }
}

function appContentFromStoredFile(file: Pick<MyBookFile, 'type'>, value: string) {
  if (file.type === 'spreadsheet') return value
  try {
    return JSON.stringify(myBookMarkdownToDocument(value))
  } catch {
    return value
  }
}

export async function writeLocalWorkspaceFile(file: Pick<MyBookFile, 'id' | 'type' | 'name' | 'content'>) {
  try {
    const directory = await filesDirectory()
    if (!directory) return
    const exactHandle = await directory.getFileHandle(exactContentFileName(file), { create: true })
    const exactWritable = await exactHandle.createWritable()
    await exactWritable.write(file.content)
    await exactWritable.close()

    const portableHandle = await directory.getFileHandle(portableFileName(file), { create: true })
    const portableWritable = await portableHandle.createWritable()
    await portableWritable.write(file.type === 'spreadsheet' ? file.content : documentMarkdown(file))
    await portableWritable.close()
  } catch (error) {
    devLog('warn', 'Could not write local workspace file.', error)
  }
}

export async function readLocalWorkspaceFile(file: Pick<MyBookFile, 'id' | 'type'>) {
  try {
    const directory = await filesDirectory()
    if (!directory) return null
    try {
      const exactHandle = await directory.getFileHandle(exactContentFileName(file))
      return await (await exactHandle.getFile()).text()
    } catch {
      const portableHandle = await directory.getFileHandle(portableFileName(file))
      const stored = await (await portableHandle.getFile()).text()
      return appContentFromStoredFile(file, stored)
    }
  } catch {
    return null
  }
}

export async function deleteLocalWorkspaceFile(file: Pick<MyBookFile, 'id' | 'type'>) {
  try {
    const directory = await filesDirectory()
    if (!directory) return
    await Promise.allSettled([
      directory.removeEntry(exactContentFileName(file)),
      directory.removeEntry(portableFileName(file)),
    ])
  } catch {
    // Removing a missing OPFS mirror should not block app-level deletion.
  }
}
