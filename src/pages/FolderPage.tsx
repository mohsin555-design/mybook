import { useParams } from 'react-router-dom'

import { FolderManagerView } from '../components/files/FolderManagerView'

export function FolderPage() {
  const { folderId } = useParams()

  return <FolderManagerView folderId={folderId ?? null} />
}
