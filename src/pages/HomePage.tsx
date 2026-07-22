import {
  ArrowUpTrayIcon,
  DocumentPlusIcon,
  FolderPlusIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TableCellsIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

import { IconButton } from '../components/common/IconButton'
import { MobileBottomSheet } from '../components/common/MobileBottomSheet'
import { PageHeader } from '../components/common/PageHeader'
import { FileCard } from '../components/files/FileCard'
import { FileActionsMenu } from '../components/files/FileActionsMenu'
import { FileNameDialog } from '../components/files/FileNameDialog'
import { FolderCard } from '../components/files/FolderCard'
import type { MyBookFile } from '../types/files'
import { useState } from 'react'
import { useLibraryData } from '../hooks/useLibraryData'
import { fileRepository } from '../database/repositories'

export function HomePage() {
  const navigate = useNavigate()
  const { files: storeFiles, folders: storeFolders } = useLibraryData()
  const [renameTarget, setRenameTarget] = useState<MyBookFile | null>(null)
  const recentFiles = [...storeFiles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)
  const recentFolders = storeFolders.filter((folder) => folder.parentId === null).slice(0, 3)

  return (
    <div className="space-y-9">
      <PageHeader
        title="MyBook"
        description="Pick up where you left off."
        actions={
          <>
            <IconButton label="Search MyBook" variant="ghost" onPress={() => navigate('/search')}>
              <MagnifyingGlassIcon aria-hidden="true" className="size-6" />
            </IconButton>
            <IconButton label="Open account settings" variant="ghost" onPress={() => navigate('/settings')}>
              <UserCircleIcon aria-hidden="true" className="size-7" />
            </IconButton>
          </>
        }
      />

      <section aria-labelledby="recent-files-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="recent-files-heading" className="text-lg font-semibold leading-7">Recent files</h2>
          <button type="button" onClick={() => navigate('/search')} className="min-h-11 rounded-lg px-2 text-sm font-medium text-accent">View all</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentFiles.map((file) => (
            <FileCard
              key={file.id}
              name={file.name}
              meta={`Edited ${new Date(file.updatedAt).toLocaleDateString()}`}
              type={file.type}
              syncStatus={file.syncStatus}
              folderName={storeFolders.find((folder) => folder.id === file.folderId)?.name ?? 'MyBook'}
              onOpen={() => navigate(`/${file.type}/${file.id}`)}
              action={<FileActionsMenu fileName={file.name} folders={storeFolders} currentFolderId={file.folderId} onRename={() => setRenameTarget(file)} onDuplicate={() => void fileRepository.duplicate(file.id)} onMove={(folderId) => void fileRepository.update(file.id, { folderId })} onDelete={() => void fileRepository.delete(file.id)} />}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="folders-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="folders-heading" className="text-lg font-semibold leading-7">Folders</h2>
          <button type="button" onClick={() => navigate('/folders')} className="min-h-11 rounded-lg px-2 text-sm font-medium text-accent">View all</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {recentFolders.map((folder) => (
            <FolderCard
              key={folder.id}
              name={folder.name}
              itemCount={storeFiles.filter((file) => file.folderId === folder.id).length + storeFolders.filter((item) => item.parentId === folder.id).length}
              onOpen={() => navigate(`/folders/${folder.id}`)}
            />
          ))}
        </div>
      </section>

      <MobileBottomSheet
        trigger={<><PlusIcon aria-hidden="true" className="size-7" /><span className="sr-only">Create new</span></>}
        triggerLabel="Create new"
        triggerClassName="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 size-14 min-h-14 min-w-14 rounded-full bg-accent text-accent-foreground shadow-lg sm:right-6 lg:bottom-8 lg:right-8"
        title="Create new"
      >
        <div role="menu" aria-label="Create options" className="space-y-1 pb-[env(safe-area-inset-bottom)]">
          <CreateOption icon={DocumentPlusIcon} label="New document" onSelect={async () => { const result = await fileRepository.create('document'); if (result.data) navigate(`/document/${result.data.id}`) }} />
          <CreateOption icon={TableCellsIcon} label="New spreadsheet" onSelect={async () => { const result = await fileRepository.create('spreadsheet'); if (result.data) navigate(`/spreadsheet/${result.data.id}`) }} />
          <CreateOption icon={FolderPlusIcon} label="New folder" onSelect={() => navigate('/folders')} />
          <CreateOption icon={ArrowUpTrayIcon} label="Upload file" />
        </div>
      </MobileBottomSheet>
      <FileNameDialog fileName={renameTarget?.name ?? ''} isOpen={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} onSubmit={(name) => renameTarget ? fileRepository.update(renameTarget.id, { name }) : Promise.resolve({ success: false })} />
    </div>
  )
}

interface CreateOptionProps {
  icon: typeof DocumentPlusIcon
  label: string
  onSelect?: () => void
}

function CreateOption({ icon: Icon, label, onSelect }: CreateOptionProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left text-base font-medium hover:bg-[var(--app-subtle)]"
    >
      <Icon aria-hidden="true" className="size-6 text-muted" />
      {label}
    </button>
  )
}
