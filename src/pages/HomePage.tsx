import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '../components/common/EmptyState'
import { PageHeader } from '../components/common/PageHeader'
import { CreateItemDrawer } from '../components/files/CreateItemDrawer'
import { DeleteFileDialog } from '../components/files/DeleteFileDialog'
import { FileActionsMenu } from '../components/files/FileActionsMenu'
import { FileCard } from '../components/files/FileCard'
import { FileNameDialog } from '../components/files/FileNameDialog'
import { FolderNameDialog } from '../components/files/FolderNameDialog'
import { toast } from '../components/ui/toast'
import { fileRepository, folderRepository } from '../database/repositories'
import { useLibraryData } from '../hooks/useLibraryData'
import type { MyBookFile } from '../types/files'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { formatUpdatedAt } from '../utils/dateFormat'
import { deletedToast } from '../utils/deleteToast'

type HomeTab = 'recent' | 'favorites' | 'all'

export function HomePage() {
  const navigate = useNavigate()
  const { files, folders } = useLibraryData()
  const [activeTab, setActiveTab] = useState<HomeTab>('recent')
  const [renameTarget, setRenameTarget] = useState<MyBookFile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MyBookFile | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const recentFiles = [...files].sort(compareFilesByUpdatedAt)
  const visibleFiles = activeTab === 'favorites' ? [] : activeTab === 'all' ? files : recentFiles
  const rootFolderNames = folders.filter((folder) => folder.parentId === null).map((folder) => folder.name)
  const emptyState = emptyHomeState(activeTab)

  const deleteFile = (file: MyBookFile) => {
    void fileRepository.delete(file.id).then((result) => {
      if (!result.success) return
      toast.add(deletedToast({
        itemName: file.name,
        onUndo: () => { void fileRepository.restore(file.id) },
      }))
    })
  }

  const fileList = visibleFiles.length ? (
    <div className="px-1">
      {visibleFiles.map((file) => (
        <FileCard
          key={file.id}
          name={file.name}
          meta={`Updated ${formatUpdatedAt(file.updatedAt)}`}
          type={file.type}
          syncStatus={file.syncStatus}
          folderName={folders.find((folder) => folder.id === file.folderId)?.name ?? 'MyBook'}
          onOpen={() => navigate(`/${file.type}/${file.id}`)}
          action={
            <FileActionsMenu
              fileName={file.name}
              folders={folders}
              currentFolderId={file.folderId}
              onRename={() => setRenameTarget(file)}
              onDuplicate={() => void fileRepository.duplicate(file.id)}
              onMove={(folderId) => void fileRepository.update(file.id, { folderId })}
              onDelete={() => setDeleteTarget(file)}
            />
          }
        />
      ))}
    </div>
  ) : (
    <div className="px-4 pt-12">
      <EmptyState
        title={emptyState.title}
        description={emptyState.description}
      />
    </div>
  )

  return (
    <div className="px-4">
      <PageHeader title="Home" />

      <Tabs
        className="-mx-4 mt-2"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as HomeTab)}
      >
        <TabsList aria-label="File view" className="mx-4 grid w-auto grid-cols-3">
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="all">All files</TabsTrigger>
        </TabsList>
        <TabsContent value="recent">{activeTab === 'recent' ? fileList : null}</TabsContent>
        <TabsContent value="favorites">{activeTab === 'favorites' ? fileList : null}</TabsContent>
        <TabsContent value="all">{activeTab === 'all' ? fileList : null}</TabsContent>
      </Tabs>

      <CreateItemDrawer folderId={null} onCreateFolder={() => setIsCreatingFolder(true)} />

      <FileNameDialog
        fileName={renameTarget?.name ?? ''}
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        onSubmit={(name) => renameTarget
          ? fileRepository.update(renameTarget.id, { name })
          : Promise.resolve({ success: false })}
      />
      <FolderNameDialog
        isOpen={isCreatingFolder}
        title="Create folder"
        submitLabel="Create"
        onClose={() => setIsCreatingFolder(false)}
        existingFolderNames={rootFolderNames}
        onSubmit={(name) => folderRepository.create(name)}
        onSuccess={(result) => {
          if (result.data) {
            navigate(`/folders/${result.data.id}`)
            toast.add({ title: `"${result.data.name}" created`, type: 'success', priority: 'low' })
          }
        }}
      />
      <DeleteFileDialog
        isOpen={Boolean(deleteTarget)}
        fileName={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteFile(deleteTarget)
        }}
      />
    </div>
  )
}

function emptyHomeState(activeTab: HomeTab) {
  if (activeTab === 'recent') {
    return {
      title: 'No recent files',
      description: 'Files you open or edit will appear here.',
    }
  }
  if (activeTab === 'favorites') {
    return {
      title: 'No favorite files yet',
      description: 'Favorite files will appear here.',
    }
  }
  return {
    title: 'No files yet',
    description: 'Create a document or spreadsheet to get started.',
  }
}

function compareFilesByUpdatedAt(a: MyBookFile, b: MyBookFile) {
  const updated = b.updatedAt.localeCompare(a.updatedAt)
  if (updated !== 0) return updated
  const name = a.name.localeCompare(b.name, 'en-US', { sensitivity: 'base' })
  if (name !== 0) return name
  return a.id.localeCompare(b.id)
}
