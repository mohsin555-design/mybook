import { useLiveQuery } from 'dexie-react-hooks'

import { fileRepository, folderRepository } from '../database/repositories'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

export function useLibraryData(includeDeleted = false) {
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const files = useLiveQuery(() => fileRepository.list(includeDeleted), [includeDeleted, workspaceMode], [])
  const folders = useLiveQuery(() => folderRepository.list(includeDeleted), [includeDeleted, workspaceMode], [])
  return { files, folders, isLoading: files === undefined || folders === undefined }
}
