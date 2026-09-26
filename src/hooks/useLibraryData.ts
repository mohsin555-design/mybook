import { useLiveQuery } from 'dexie-react-hooks'

import { fileRepository, folderRepository, onClearAccountDriveCache } from '../database/repositories'
import { useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import type { MyBookFile, MyBookFolder } from '../types/files'

const memoryCache = {
  files: new Map<string, MyBookFile[]>(),
  folders: new Map<string, MyBookFolder[]>(),
}

export function clearLibraryCache() {
  memoryCache.files.clear()
  memoryCache.folders.clear()
}

onClearAccountDriveCache(clearLibraryCache)


export function useLibraryData(includeDeleted = false) {
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const email = useAuthStore((state) => state.email)
  const cacheKey = `${workspaceMode ?? 'default'}:${workspaceMode === 'local' ? 'local' : (email ?? 'anon')}:${includeDeleted ? 'all' : 'active'}`

  const cachedFiles = memoryCache.files.get(cacheKey)
  const cachedFolders = memoryCache.folders.get(cacheKey)

  const files = useLiveQuery(
    async () => {
      const result = await fileRepository.list(includeDeleted)
      memoryCache.files.set(cacheKey, result)
      return result
    },
    [includeDeleted, workspaceMode, email, cacheKey],
    cachedFiles,
  )

  const folders = useLiveQuery(
    async () => {
      const result = await folderRepository.list(includeDeleted)
      memoryCache.folders.set(cacheKey, result)
      return result
    },
    [includeDeleted, workspaceMode, email, cacheKey],
    cachedFolders,
  )

  const isLoading = files === undefined || folders === undefined

  return {
    files: files ?? cachedFiles ?? [],
    folders: folders ?? cachedFolders ?? [],
    isLoading,
  }
}

