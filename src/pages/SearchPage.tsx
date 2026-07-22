import { DocumentPlusIcon, TableCellsIcon } from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppButton } from '../components/common/AppButton'
import { EmptyState } from '../components/common/EmptyState'
import { PageHeader } from '../components/common/PageHeader'
import { SearchInput } from '../components/common/SearchInput'
import { FileActionsMenu } from '../components/files/FileActionsMenu'
import { FileCard } from '../components/files/FileCard'
import { FileNameDialog } from '../components/files/FileNameDialog'
import { fileRepository } from '../database/repositories'
import { useLibraryData } from '../hooks/useLibraryData'
import type { FileFilter, FileSort, MyBookFile } from '../types/files'

export function SearchPage() {
  const navigate = useNavigate()
  const { files, folders } = useLibraryData()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FileFilter>('all')
  const [sort, setSort] = useState<FileSort>('recent')
  const [renameTarget, setRenameTarget] = useState<MyBookFile | null>(null)

  const visibleFiles = useMemo(() => files
    .filter((file) => filter === 'all' || file.type === filter)
    .filter((file) => file.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name)
      if (sort === 'name-desc') return b.name.localeCompare(a.name)
      if (sort === 'type') return a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
      if (sort === 'oldest') return a.updatedAt.localeCompare(b.updatedAt)
      return b.updatedAt.localeCompare(a.updatedAt)
    }), [files, filter, query, sort])

  const create = async (type: MyBookFile['type']) => {
    const result = await fileRepository.create(type)
    if (result.data) navigate(`/${type}/${result.data.id}`)
  }

  return (
    <div className="space-y-7">
      <PageHeader title="Search" description="Find and manage documents and spreadsheets." actions={<div className="flex gap-2"><AppButton variant="secondary" onPress={() => create('document')}><DocumentPlusIcon className="size-5" />Document</AppButton><AppButton variant="secondary" onPress={() => create('spreadsheet')}><TableCellsIcon className="size-5" />Spreadsheet</AppButton></div>} />
      <SearchInput label="Search files" placeholder="Search by file name" value={query} onChange={setQuery} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Filter
          <select value={filter} onChange={(event) => setFilter(event.target.value as FileFilter)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-base">
            <option value="all">All</option><option value="document">Documents</option><option value="spreadsheet">Spreadsheets</option>
          </select>
        </label>
        <label className="text-sm font-medium">Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as FileSort)} className="mt-1 block min-h-11 w-full rounded-[10px] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-base">
            <option value="recent">Recently edited</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="type">File type</option><option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-muted" aria-live="polite">{visibleFiles.length} {visibleFiles.length === 1 ? 'file' : 'files'}</p>
      {visibleFiles.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleFiles.map((file) => {
        const folderName = folders.find((folder) => folder.id === file.folderId)?.name ?? 'MyBook'
        return <FileCard key={file.id} name={file.name} meta={`Edited ${new Date(file.updatedAt).toLocaleDateString()}`} type={file.type} folderName={folderName} syncStatus={file.syncStatus} onOpen={() => navigate(`/${file.type}/${file.id}`)} action={<FileActionsMenu fileName={file.name} folders={folders} currentFolderId={file.folderId} onRename={() => setRenameTarget(file)} onDuplicate={() => void fileRepository.duplicate(file.id)} onMove={(folderId) => void fileRepository.update(file.id, { folderId })} onDelete={() => void fileRepository.delete(file.id)} />} />
      })}</div> : <EmptyState title="No files found" description="Try another search or change the file filter." />}
      <FileNameDialog fileName={renameTarget?.name ?? ''} isOpen={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} onSubmit={(name) => renameTarget ? fileRepository.update(renameTarget.id, { name }) : Promise.resolve({ success: false })} />
    </div>
  )
}
