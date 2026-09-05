import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '../components/common/EmptyState'
import { PageHeader } from '../components/common/PageHeader'
import { DeleteFileDialog } from '../components/files/DeleteFileDialog'
import { FileCard } from '../components/files/FileCard'
import { FolderCard } from '../components/files/FolderCard'
import { TrashActionsMenu } from '../components/files/TrashActionsMenu'
import { fileRepository, folderRepository } from '../database/repositories'
import { useLibraryData } from '../hooks/useLibraryData'
import type { MyBookFile, MyBookFolder } from '../types/files'

type TrashTarget =
  | { kind: 'file'; item: MyBookFile }
  | { kind: 'folder'; item: MyBookFolder }

export function TrashPage() {
  const navigate = useNavigate()
  const { files, folders } = useLibraryData(true)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<TrashTarget | null>(null)
  const deletedFolderIds = new Set(folders.filter((folder) => folder.isDeleted).map((folder) => folder.id))
  const hasDeletedFolderAncestor = (folderId: string | null): boolean => {
    let currentId = folderId
    const seen = new Set<string>()
    while (currentId) {
      if (seen.has(currentId)) return false
      seen.add(currentId)
      if (deletedFolderIds.has(currentId)) return true
      currentId = folders.find((folder) => folder.id === currentId)?.parentId ?? null
    }
    return false
  }
  const trashedFiles = files.filter((file) => file.isDeleted && !hasDeletedFolderAncestor(file.folderId))
  const trashedFolders = folders.filter((folder) => folder.isDeleted && !hasDeletedFolderAncestor(folder.parentId))
  const trashItems: TrashTarget[] = [
    ...trashedFolders.map((item) => ({ kind: 'folder' as const, item })),
    ...trashedFiles.map((item) => ({ kind: 'file' as const, item })),
  ].sort((a, b) => new Date(b.item.updatedAt).getTime() - new Date(a.item.updatedAt).getTime())
  const folderCount = (targetId: string) => folders.filter((folder) => folder.parentId === targetId).length
  const fileCount = (targetId: string) => files.filter((file) => file.folderId === targetId).length
  return (
    <div className="px-4">
      <PageHeader title="Trash" description="Restore files and folders or permanently remove them." />
      {trashItems.length ? (
        <div className="-mx-4 mt-4 px-1">
          {trashItems.map((target) => {
            if (target.kind === 'folder') {
              const folder = target.item
              return (
                <FolderCard
                  key={`folder:${folder.id}`}
                  name={folder.name}
                  fileCount={fileCount(folder.id)}
                  folderCount={folderCount(folder.id)}
                  action={(
                    <TrashActionsMenu
                      fileName={folder.name}
                      itemKind="folder"
                      onRestore={() => void folderRepository.restore(folder.id)}
                      onDelete={() => setPermanentDeleteTarget(target)}
                    />
                  )}
                />
              )
            }
            const file = target.item
            return (
              <FileCard
                key={`file:${file.id}`}
                name={file.name}
                meta={`Deleted ${new Date(file.updatedAt).toLocaleDateString()}`}
                type={file.type}
                folderName={folders.find((folder) => folder.id === file.folderId)?.name ?? 'MyBook'}
                syncStatus={file.syncStatus}
                action={(
                  <TrashActionsMenu
                    fileName={file.name}
                    onRestore={() => void fileRepository.restore(file.id)}
                    onDelete={() => setPermanentDeleteTarget(target)}
                  />
                )}
              />
            )
          })}
        </div>
      ) : (
        <div className="pt-16">
          <EmptyState
            title="Trash is empty"
            description="Files and folders you delete will appear here."
            action={<button type="button" onClick={() => navigate('/search')} className="min-h-11 rounded-lg px-3 text-primary">Browse files</button>}
          />
        </div>
      )}
      <DeleteFileDialog
        isOpen={Boolean(permanentDeleteTarget)}
        fileName={permanentDeleteTarget?.item.name ?? ''}
        itemKind={permanentDeleteTarget?.kind ?? 'file'}
        mode="permanent"
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={() => {
          if (!permanentDeleteTarget) return
          if (permanentDeleteTarget.kind === 'folder') void folderRepository.permanentlyDelete(permanentDeleteTarget.item.id)
          else void fileRepository.permanentlyDelete(permanentDeleteTarget.item.id)
        }}
      />
    </div>
  )
}
