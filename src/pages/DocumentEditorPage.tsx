import { useParams } from 'react-router-dom'

import { TiptapDocumentEditor } from '../components/document-editor/TiptapDocumentEditor'

export function DocumentEditorPage() {
  const { documentId } = useParams()
  return documentId ? <TiptapDocumentEditor fileId={documentId} /> : null
}
