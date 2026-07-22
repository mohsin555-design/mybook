import { useLiveQuery } from 'dexie-react-hooks'

import { fileRepository, folderRepository } from '../database/repositories'

export function useLibraryData(includeDeleted = false) {
  const files = useLiveQuery(() => fileRepository.list(includeDeleted), [includeDeleted], [])
  const folders = useLiveQuery(() => folderRepository.list(), [], [])
  return { files, folders, isLoading: files === undefined || folders === undefined }
}
