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
  return <div className="px-4"><PageHeader title="Trash" description="Restore files or permanently remove them." />{trashedFiles.length ? <div className="-mx-4 mt-4 px-1">{trashedFiles.map((file) => <FileCard key={file.id} name={file.name} meta={`Deleted ${new Date(file.updatedAt).toLocaleDateString()}`} type={file.type} folderName={folders.find((folder) => folder.id === file.folderId)?.name ?? 'MyBook'} syncStatus={file.syncStatus} action={<TrashActionsMenu fileName={file.name} onRestore={() => void fileRepository.restore(file.id)} onDelete={() => void fileRepository.permanentlyDelete(file.id)} />} />)}</div> : <div className="pt-16"><EmptyState title="Trash is empty" description="Files you delete will appear here." action={<button type="button" onClick={() => navigate('/search')} className="min-h-11 rounded-lg px-3 text-accent">Browse files</button>} /></div>}</div>
}
