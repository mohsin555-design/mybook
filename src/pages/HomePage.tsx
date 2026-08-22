import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '../components/common/EmptyState'
import { PageHeader } from '../components/common/PageHeader'
import { CreateItemDrawer } from '../components/files/CreateItemDrawer'
import { FileActionsMenu } from '../components/files/FileActionsMenu'
import { FileCard } from '../components/files/FileCard'
import { FileNameDialog } from '../components/files/FileNameDialog'
import { FolderNameDialog } from '../components/files/FolderNameDialog'
import { fileRepository, folderRepository } from '../database/repositories'
import { useLibraryData } from '../hooks/useLibraryData'
import type { MyBookFile } from '../types/files'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

type HomeTab = 'recent' | 'favorites' | 'all'

export function HomePage() {
  const navigate = useNavigate()
  const { files, folders } = useLibraryData()
  const [activeTab, setActiveTab] = useState<HomeTab>('recent')
  const [renameTarget, setRenameTarget] = useState<MyBookFile | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const recentFiles = [...files].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const visibleFiles = activeTab === 'favorites' ? [] : activeTab === 'all' ? files : recentFiles

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
              onDelete={() => void fileRepository.delete(file.id)}
            />
          }
        />
      ))}
    </div>
  ) : (
    <div className="px-4 pt-12">
      <EmptyState
        title={activeTab === 'favorites' ? 'No favorite files yet' : 'No files yet'}
        description={activeTab === 'favorites' ? 'Favorite files will appear here.' : 'Create a document or spreadsheet to get started.'}
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
        onSubmit={(name) => folderRepository.create(name)}
      />
    </div>
  )
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
