import { ChevronLeftIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { fileRepository, folderRepository } from '../../database/repositories'
import { useLibraryData } from '../../hooks/useLibraryData'
import type { MyBookFile, MyBookFolder } from '../../types/files'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { PageHeader } from '../common/PageHeader'
import { DeleteFolderDialog } from './DeleteFolderDialog'
import { CreateItemDrawer } from './CreateItemDrawer'
import { FileCard } from './FileCard'
import { FileActionsMenu } from './FileActionsMenu'
import { FileNameDialog } from './FileNameDialog'
import { FolderActionsMenu } from './FolderActionsMenu'
import { FolderCard } from './FolderCard'
import { FolderNameDialog } from './FolderNameDialog'

interface FolderManagerViewProps {
  folderId: string | null
}

export function FolderManagerView({ folderId }: FolderManagerViewProps) {
  const navigate = useNavigate()
  const { files, folders } = useLibraryData()
  const [isCreating, setIsCreating] = useState(false)
  const [renameTarget, setRenameTarget] = useState<MyBookFolder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyBookFolder | null>(null)
  const [fileRenameTarget, setFileRenameTarget] = useState<MyBookFile | null>(null)
  const currentFolder = folderId ? folders.find((folder) => folder.id === folderId) : null
  const childFolders = folders.filter((folder) => folder.parentId === folderId)
  const childFiles = files.filter((file) => file.folderId === folderId)

  if (folderId && !currentFolder) {
    return (
      <EmptyState
        title="Folder not found"
        description="This folder may have been deleted."
        action={<AppButton variant="primary" onPress={() => navigate('/folders')}>Back to folders</AppButton>}
      />
    )
  }

  const itemCount = (targetId: string) =>
    folders.filter((folder) => folder.parentId === targetId).length +
    files.filter((file) => file.folderId === targetId).length

  const requestDelete = (folder: MyBookFolder) => {
    if (itemCount(folder.id) > 0) setDeleteTarget(folder)
    else {
      void folderRepository.delete(folder.id)
      if (folder.id === folderId) navigate(folder.parentId ? `/folders/${folder.parentId}` : '/folders')
    }
  }

  return (
    <div className="px-4">
      <PageHeader
        title={currentFolder?.name ?? 'Library'}
        leading={currentFolder ? (
          <button
            type="button"
            aria-label="Back to parent folder"
            onClick={() => navigate(currentFolder.parentId ? `/folders/${currentFolder.parentId}` : '/folders')}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-default"
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        actions={currentFolder ? (
          <div className="flex size-10 items-center justify-center rounded-full bg-default">
            <FolderActionsMenu
              folderName={currentFolder.name}
              folders={folders}
              folderId={currentFolder.id}
              currentParentId={currentFolder.parentId}
              onRename={() => setRenameTarget(currentFolder)}
              onMove={(destination) => void folderRepository.update(currentFolder.id, { parentId: destination })}
              onDelete={() => requestDelete(currentFolder)}
            />
          </div>
        ) : (
          <AppButton
            className="min-h-8 rounded-full bg-danger/10 px-3 text-sm text-danger"
            variant="ghost"
            onPress={() => navigate('/trash')}
          >
            <TrashIcon aria-hidden="true" className="size-4" />
            Trash
          </AppButton>
        )}
      />

      <div className="-mx-4 mt-4 px-1">
        {childFiles.map((file) => (
          <FileCard
            key={file.id}
            name={file.name}
            meta={`Updated ${new Date(file.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
            type={file.type}
            syncStatus={file.syncStatus}
            folderName={currentFolder?.name ?? 'MyBook'}
            onOpen={() => navigate(`/${file.type}/${file.id}`)}
            action={
              <FileActionsMenu
                fileName={file.name}
                folders={folders}
                currentFolderId={file.folderId}
                onRename={() => setFileRenameTarget(file)}
                onDuplicate={() => void fileRepository.duplicate(file.id)}
                onMove={(destination) => void fileRepository.update(file.id, { folderId: destination })}
                onDelete={() => void fileRepository.delete(file.id)}
              />
            }
          />
        ))}
        {childFolders.map((folder) => (
          <FolderCard
            key={folder.id}
            name={folder.name}
            itemCount={itemCount(folder.id)}
            driveStatus={folder.driveFolderId ? 'Synced to Drive' : 'Drive folder pending'}
            onOpen={() => navigate(`/folders/${folder.id}`)}
            action={
              <FolderActionsMenu
                folderName={folder.name}
                folders={folders}
                folderId={folder.id}
                currentParentId={folder.parentId}
                onRename={() => setRenameTarget(folder)}
                onMove={(destination) => void folderRepository.update(folder.id, { parentId: destination })}
                onDelete={() => requestDelete(folder)}
              />
            }
          />
        ))}
      </div>

      {childFolders.length === 0 && childFiles.length === 0 ? (
        <div className="pt-16">
          <EmptyState
            title={folderId ? 'This folder is empty' : 'No folders or files'}
            description="Create a folder or move a file here to get started."
          />
        </div>
      ) : null}

      <CreateItemDrawer folderId={folderId} onCreateFolder={() => setIsCreating(true)} />

      <FolderNameDialog
        isOpen={isCreating}
        title="Create folder"
        submitLabel="Create"
        onClose={() => setIsCreating(false)}
        onSubmit={(name) => folderRepository.create(name, folderId)}
      />
      <FolderNameDialog
        isOpen={Boolean(renameTarget)}
        title="Rename folder"
        submitLabel="Save"
        initialName={renameTarget?.name}
        onClose={() => setRenameTarget(null)}
        onSubmit={(name) => renameTarget ? folderRepository.update(renameTarget.id, { name }) : Promise.resolve({ success: false })}
      />
      <DeleteFolderDialog
        isOpen={Boolean(deleteTarget)}
        folderName={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          const deletingCurrent = deleteTarget.id === folderId
          const destination = deleteTarget.parentId
          void folderRepository.delete(deleteTarget.id)
          if (deletingCurrent) navigate(destination ? `/folders/${destination}` : '/folders')
        }}
      />
      <FileNameDialog fileName={fileRenameTarget?.name ?? ''} isOpen={Boolean(fileRenameTarget)} onClose={() => setFileRenameTarget(null)} onSubmit={(name) => fileRenameTarget ? fileRepository.update(fileRenameTarget.id, { name }) : Promise.resolve({ success: false })} />
    </div>
  )
}
