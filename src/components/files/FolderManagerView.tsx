import { ChevronRightIcon, FolderPlusIcon } from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { fileRepository, folderRepository } from '../../database/repositories'
import { useLibraryData } from '../../hooks/useLibraryData'
import type { MyBookFile, MyBookFolder } from '../../types/files'
import { AppButton } from '../common/AppButton'
import { EmptyState } from '../common/EmptyState'
import { PageHeader } from '../common/PageHeader'
import { DeleteFolderDialog } from './DeleteFolderDialog'
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

  const breadcrumbs = useMemo(() => {
    const items: MyBookFolder[] = []
    let current = currentFolder
    while (current) {
      items.unshift(current)
      current = current.parentId
        ? folders.find((folder) => folder.id === current?.parentId)
        : undefined
    }
    return items
  }, [currentFolder, folders])

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
    else void folderRepository.delete(folder.id)
  }

  return (
    <div className="space-y-8">
      {folderId ? (
        <nav aria-label="Folder breadcrumbs">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            <li><Link to="/folders" className="flex min-h-11 items-center rounded-lg px-2 hover:text-foreground">MyBook</Link></li>
            {breadcrumbs.map((folder, index) => (
              <li key={folder.id} className="flex items-center">
                <ChevronRightIcon aria-hidden="true" className="size-4" />
                {index === breadcrumbs.length - 1 ? (
                  <span aria-current="page" className="px-2 font-medium text-foreground">{folder.name}</span>
                ) : (
                  <Link to={`/folders/${folder.id}`} className="flex min-h-11 items-center rounded-lg px-2 hover:text-foreground">{folder.name}</Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <PageHeader
        title={currentFolder?.name ?? 'Folders'}
        description={folderId ? 'Browse folders and files in this location.' : 'Organize your documents and spreadsheets.'}
        actions={
          <AppButton variant="primary" onPress={() => setIsCreating(true)}>
            <FolderPlusIcon aria-hidden="true" className="size-5" />
            New folder
          </AppButton>
        }
      />

      {childFolders.length > 0 ? (
        <section aria-labelledby="subfolders-heading">
          <h2 id="subfolders-heading" className="mb-4 text-lg font-semibold">{folderId ? 'Folders' : 'Your folders'}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        </section>
      ) : null}

      {childFiles.length > 0 ? (
        <section aria-labelledby="folder-files-heading">
          <h2 id="folder-files-heading" className="mb-4 text-lg font-semibold">Files</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {childFiles.map((file) => (
              <FileCard
                key={file.id}
                name={file.name}
                meta={`Edited ${new Date(file.updatedAt).toLocaleDateString()}`}
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
          </div>
        </section>
      ) : null}

      {childFolders.length === 0 && childFiles.length === 0 ? (
        <EmptyState
          title={folderId ? 'This folder is empty' : 'No folders or files'}
          description="Create a folder or move a file here to get started."
          action={<AppButton variant="primary" onPress={() => setIsCreating(true)}>Create folder</AppButton>}
        />
      ) : null}

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
