import { useNavigate } from 'react-router-dom'

import { EmptyState } from '../components/common/EmptyState'
import { PageHeader } from '../components/common/PageHeader'
import { FileCard } from '../components/files/FileCard'
import { TrashActionsMenu } from '../components/files/TrashActionsMenu'
import { fileRepository } from '../database/repositories'
import { useLibraryData } from '../hooks/useLibraryData'

export function TrashPage() {
  const navigate = useNavigate()
  const { files, folders } = useLibraryData(true)
  const trashedFiles = files.filter((file) => file.isDeleted)
  return <div className="space-y-7"><PageHeader title="Trash" description="Restore files or permanently remove them." />{trashedFiles.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{trashedFiles.map((file) => <FileCard key={file.id} name={file.name} meta={`Deleted after ${new Date(file.updatedAt).toLocaleDateString()}`} type={file.type} folderName={folders.find((folder) => folder.id === file.folderId)?.name ?? 'MyBook'} syncStatus={file.syncStatus} action={<TrashActionsMenu fileName={file.name} onRestore={() => void fileRepository.restore(file.id)} onDelete={() => void fileRepository.permanentlyDelete(file.id)} />} />)}</div> : <EmptyState title="Trash is empty" description="Files you delete will appear here." action={<button type="button" onClick={() => navigate('/search')} className="min-h-11 rounded-lg px-3 text-accent">Browse files</button>} />}</div>
}
