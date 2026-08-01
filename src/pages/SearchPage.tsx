import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '../components/common/EmptyState'
import { PageHeader } from '../components/common/PageHeader'
import { SearchInput } from '../components/common/SearchInput'
import { FileActionsMenu } from '../components/files/FileActionsMenu'
import { FileCard } from '../components/files/FileCard'
import { FileNameDialog } from '../components/files/FileNameDialog'
import { fileRepository } from '../database/repositories'
import { useLibraryData } from '../hooks/useLibraryData'
import type { MyBookFile } from '../types/files'

export function SearchPage() {
  const navigate = useNavigate()
  const { files, folders } = useLibraryData()
  const [query, setQuery] = useState('')
  const [renameTarget, setRenameTarget] = useState<MyBookFile | null>(null)

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return []
    return files
      .filter((file) => file.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [files, query])

  return (
    <div className="px-4">
      <PageHeader title="Search" />
      <div>
        <div className="mt-3">
          <SearchInput
            label="Search files"
            placeholder="Search..."
            value={query}
            onChange={setQuery}
          />
        </div>
      </div>

      {visibleFiles.length ? (
        <div className="-mx-4 mt-4 px-1">
          {visibleFiles.map((file) => (
            <FileCard
              key={file.id}
              name={file.name}
              meta={`Updated ${new Date(file.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
              type={file.type}
              folderName={folders.find((folder) => folder.id === file.folderId)?.name ?? 'MyBook'}
              syncStatus={file.syncStatus}
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
      ) : query.trim() ? (
        <div className="pt-16">
          <EmptyState title="No files found" description="Try another file name." />
        </div>
      ) : null}

      <FileNameDialog
        fileName={renameTarget?.name ?? ''}
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        onSubmit={(name) => renameTarget
          ? fileRepository.update(renameTarget.id, { name })
          : Promise.resolve({ success: false })}
      />
    </div>
  )
}
